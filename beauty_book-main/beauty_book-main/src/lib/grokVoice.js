// ─── Session voix temps réel avec l'agent Grok (xAI) ─────────────────────────
// Le navigateur se connecte DIRECTEMENT à wss://api.x.ai/v1/realtime en
// s'authentifiant avec un token ÉPHÉMÈRE (minté par /api/xai-token) passé dans
// le sous-protocole WebSocket `xai-client-secret.<token>`.
// La clé XAI_API_KEY n'est donc jamais exposée côté client.
//
// Stratégie de connexion :
//  1. d'abord ?agent_id=<id> (l'agent configuré dans la console xAI) ;
//  2. si le handshake échoue, repli sur ?model=grok-voice-latest + session.update
//     avec les instructions du salon (vrais services, horaires…).

const REALTIME_URL = 'wss://api.x.ai/v1/realtime';
const SAMPLE_RATE = 24000;
const CHUNK_MS = 120;

function b64encode(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}
function b64decode(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

// Worklet de capture micro (Blob URL → pas de fichier séparé à builder)
const WORKLET_SRC = `
class MicCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('bb-mic-capture', MicCapture);
`;

export class GrokVoiceSession {
  constructor({ token, agentId, instructions = '', voice = 'ara', language = 'fr', onEvent = () => {} }) {
    this.token = token;
    this.agentId = agentId;
    this.instructions = instructions;
    this.voice = voice;
    this.language = language;
    this.onEvent = onEvent;
    this.ws = null;
    this.mode = null; // 'agent' | 'direct'
    this.connected = false;
    this.muted = false;
    this._agentBuf = '';
  }

  emit(type, payload = {}) {
    try { this.onEvent(type, payload); } catch { /* callback utilisateur */ }
  }

  async connect() {
    this.emit('state', { state: 'connecting' });
    const ok = await this._tryConnect(true);
    if (!ok) {
      this.emit('state', { state: 'agent-failed' });
      const ok2 = await this._tryConnect(false);
      if (!ok2) {
        this.emit('state', { state: 'error' });
        this.emit('error', { message: "Connexion à l'agent vocal impossible. Réessayez." });
        return false;
      }
    }
    return true;
  }

  _wsUrl(withAgent) {
    return withAgent
      ? `${REALTIME_URL}?agent_id=${encodeURIComponent(this.agentId)}`
      : `${REALTIME_URL}?model=grok-voice-latest`;
  }

  _tryConnect(withAgent) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };
      let ws;
      try {
        ws = new WebSocket(this._wsUrl(withAgent), [`xai-client-secret.${this.token}`]);
      } catch (e) {
        done(false);
        return;
      }
      const timer = setTimeout(() => { try { ws.close(); } catch {} done(false); }, 9000);

      ws.onopen = () => {
        // On attend session.created / conversation.created avant de valider.
      };
      ws.onmessage = (ev) => {
        let msg = null;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!this.connected && (msg.type === 'session.created' || msg.type === 'conversation.created')) {
          this.ws = ws;
          this.connected = true;
          this.mode = withAgent ? 'agent' : 'direct';
          if (!withAgent) this._sendSessionUpdate();
          this.emit('state', { state: 'connected', mode: this.mode });
          this._startMic().catch((e) => {
            this.emit('error', { message: "Micro inaccessible : autorisez l'accès au micro." });
          });
          done(true);
          return;
        }
        if (msg.type === 'error') {
          // En mode agent, une erreur précoce (ex: agent_id rejeté) déclenche le repli.
          if (!this.connected) { try { ws.close(); } catch {} done(false); return; }
          this.emit('error', { message: msg.error?.message || 'Erreur de session vocale.' });
          return;
        }
        if (this.connected && ws === this.ws) this._handleEvent(msg);
      };
      ws.onerror = () => { if (!this.connected) { try { ws.close(); } catch {} done(false); } };
      ws.onclose = () => {
        if (!this.connected) { done(false); return; }
        if (ws === this.ws) {
          this.connected = false;
          this.emit('state', { state: 'disconnected' });
          this._stopMic();
          this._stopPlayback();
        }
      };
      // Les messages reçus sur l'ancien socket (tentative agent) après bascule sont ignorés.
      this._pendingWs = ws;
    });
  }

  _sendSessionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        voice: this.voice,
        instructions: this.instructions,
        turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 700 },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'grok-transcribe', language: this.language },
      },
    }));
  }

  // ── Micro ────────────────────────────────────────────────────────────────
  // IMPORTANT : sur mobile, le navigateur ignore souvent le sampleRate demandé
  // (48 kHz réel au lieu de 24 kHz). On rééchantillonne donc systématiquement
  // vers 24 kHz avant l'envoi, sinon l'agent reçoit un audio « chipmunk »
  // qu'il ne peut pas transcrire (impression que « l'agent n'écoute pas »).
  async _startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this._micStream = stream;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._actx = new Ctx({ sampleRate: SAMPLE_RATE });
    if (this._actx.state === 'suspended') await this._actx.resume();
    const inRate = this._actx.sampleRate || SAMPLE_RATE; // taux RÉEL de capture
    const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      await this._actx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const src = this._actx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(this._actx, 'bb-mic-capture');
    const outLen = Math.floor((SAMPLE_RATE * CHUNK_MS) / 1000); // échantillons @24kHz par envoi
    const need = Math.ceil((outLen * inRate) / SAMPLE_RATE); // échantillons d'entrée nécessaires
    let f32Acc = [];
    let f32Len = 0;
    this._lastMicEmit = 0;
    node.port.onmessage = (ev) => {
      if (this.muted || !this.connected) return;
      const f32 = ev.data;
      // Niveau micro (indicateur visuel, ~7 fois/sec)
      let peak = 0;
      for (let i = 0; i < f32.length; i += 4) {
        const a = Math.abs(f32[i]);
        if (a > peak) peak = a;
      }
      const now = performance.now();
      if (now - this._lastMicEmit > 150) {
        this._lastMicEmit = now;
        this.emit('mic-level', { level: Math.min(1, peak * 1.6) });
      }
      f32Acc.push(f32);
      f32Len += f32.length;
      while (f32Len >= need) {
        const input = new Float32Array(f32Len);
        let off = 0;
        for (const c of f32Acc) { input.set(c, off); off += c.length; }
        const i16 = new Int16Array(outLen);
        if (inRate === SAMPLE_RATE) {
          for (let i = 0; i < outLen; i++) {
            const v = Math.max(-1, Math.min(1, input[i]));
            i16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
          }
        } else {
          // Rééchantillonnage linéaire vers 24 kHz
          const ratio = inRate / SAMPLE_RATE;
          const last = need - 1;
          for (let i = 0; i < outLen; i++) {
            const pos = i * ratio;
            const i0 = Math.floor(pos);
            const frac = pos - i0;
            const s0 = input[i0] || 0;
            const s1 = input[i0 + 1 > last ? last : i0 + 1] || 0;
            const v = Math.max(-1, Math.min(1, s0 + (s1 - s0) * frac));
            i16[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
          }
        }
        const rest = f32Len - need;
        if (rest > 0) {
          const restArr = new Float32Array(rest);
          restArr.set(input.subarray(need));
          f32Acc = [restArr];
        } else {
          f32Acc = [];
        }
        f32Len = rest;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: b64encode(new Uint8Array(i16.buffer)),
          }));
        }
      }
    };
    src.connect(node);
    this._micNodes = { src, node };
    this.emit('state', { state: 'mic-live' });
  }

  _stopMic() {
    try { this._micNodes?.node?.port?.close(); } catch {}
    try { this._micNodes?.src?.disconnect(); } catch {}
    try { this._micStream?.getTracks()?.forEach((t) => t.stop()); } catch {}
    if (this._actx) this._actx.close().catch(() => {});
    this._micNodes = null;
    this._micStream = null;
    this._actx = null;
  }

  setMuted(m) {
    this.muted = !!m;
    this.emit('state', { state: this.muted ? 'muted' : 'mic-live' });
  }

  // ── Lecture audio de l'agent ─────────────────────────────────────────────
  _ensureOutCtx() {
    if (!this._octx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._octx = new Ctx({ sampleRate: SAMPLE_RATE });
      this._oNext = 0;
      this._oSources = new Set();
    }
    if (this._octx.state === 'suspended') this._octx.resume().catch(() => {});
    return this._octx;
  }

  _playChunk(b64) {
    const bytes = b64decode(b64);
    const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const ctx = this._ensureOutCtx();
    const buf = ctx.createBuffer(1, i16.length, SAMPLE_RATE);
    const data = buf.getChannelData(0);
    for (let i = 0; i < i16.length; i++) data[i] = i16[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    this._oNext = Math.max(this._oNext, now + 0.02);
    src.start(this._oNext);
    this._oNext += buf.duration;
    this._oSources.add(src);
    src.onended = () => this._oSources.delete(src);
    this.emit('speaking', { who: 'agent' });
  }

  _stopPlayback() {
    if (this._oSources) {
      for (const s of this._oSources) { try { s.stop(); } catch {} }
      this._oSources.clear();
    }
    this._oNext = 0;
  }

  // ── Événements serveur ──────────────────────────────────────────────────
  _handleEvent(msg) {
    switch (msg.type) {
      case 'input_audio_buffer.speech_started':
        this._stopPlayback();
        this.emit('speaking', { who: 'user' });
        break;
      case 'conversation.item.input_audio_transcription.updated':
      case 'conversation.item.input_audio_transcription.completed': {
        const text = msg.transcript || '';
        if (text) this.emit('user-transcript', { text, final: msg.type.endsWith('completed') });
        break;
      }
      case 'response.output_audio_transcript.delta': {
        const d = msg.delta || '';
        if (d) {
          this._agentBuf += d;
          this.emit('agent-transcript', { delta: d, done: false });
        }
        break;
      }
      case 'response.output_audio.delta':
      case 'response.audio.delta': {
        const d = msg.delta || msg.audio || '';
        if (d) this._playChunk(d);
        break;
      }
      case 'response.done': {
        if (this._agentBuf) {
          this.emit('agent-transcript', { delta: '', done: true, text: this._agentBuf });
          this._agentBuf = '';
        }
        break;
      }
      case 'response.output_audio_transcript.done': {
        const t = msg.transcript || this._agentBuf;
        if (t) this.emit('agent-transcript', { delta: '', done: true, text: t });
        this._agentBuf = '';
        break;
      }
      default:
        break;
    }
  }

  async disconnect() {
    this.connected = false;
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this._stopMic();
    this._stopPlayback();
    if (this._octx) this._octx.close().catch(() => {});
    this._octx = null;
    this.emit('state', { state: 'disconnected' });
  }
}
