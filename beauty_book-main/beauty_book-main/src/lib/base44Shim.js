import { grokChat } from './grok';

async function invokeLLMBackend({ prompt, response_json_schema, file_urls }) {
  // Grok (xAI) via le proxy serveur /api/xai-chat — la clé API reste côté serveur.
  const reply = await grokChat([{ role: 'user', content: prompt || '' }], { max_tokens: 800 });
  return reply;
}
async function generateSpeechBackend({ text }) {
  const apiClient = (await import('./apiClient')).default;
  const audio = await apiClient.request('/api/ai/tts', { method: 'POST', body: JSON.stringify({ text }), responseType: 'blob' });
  return { url: URL.createObjectURL(audio) };
}
if (typeof window !== 'undefined') {
  window.base44 ||= { integrations: { Core: {} } };
  window.base44.integrations ||= { Core: {} };
  window.base44.integrations.Core ||= {};
  Object.assign(window.base44.integrations.Core, { InvokeLLM: invokeLLMBackend, GenerateSpeech: generateSpeechBackend });
}
export { invokeLLMBackend, generateSpeechBackend };
