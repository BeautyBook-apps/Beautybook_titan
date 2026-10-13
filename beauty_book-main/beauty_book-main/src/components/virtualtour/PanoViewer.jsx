import BeautyImage from '@/components/ui/BeautyImage';
import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { X, ChevronLeft, ChevronRight, Loader2, Map, Layers, Share2, Bookmark, Maximize2, Move } from "lucide-react";

const getSceneSource = (scene) => scene?.hdr_url || scene?.hdri_url || scene?.image_url || "";
const isHdrSource = (scene, source) => Boolean(
  scene?.hdr_url || scene?.hdri_url || scene?.asset_type === "hdr" || /\.(hdr|hdri|exr)(?:$|[?#])/i.test(source || "")
);
const isExrSource = (scene, source) => Boolean(scene?.format === "exr" || /\.exr(?:$|[?#])/i.test(source || ""));

function eqToSphere(pctX, pctY) {
  const lon = (pctX / 100) * Math.PI * 2 - Math.PI;
  const lat = -(pctY / 100) * Math.PI + Math.PI / 2;
  const radius = 4.95;
  return new THREE.Vector3(
    -radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon)
  );
}

function projectToScreen(pos3D, camera, container) {
  const vec = pos3D.clone();
  vec.project(camera);
  return {
    x: ((vec.x + 1) / 2) * container.clientWidth,
    y: ((-vec.y + 1) / 2) * container.clientHeight,
    visible: vec.z < 1,
  };
}

function isInFront(pos3D, cameraDirection) {
  return pos3D.clone().normalize().dot(cameraDirection) < -0.05;
}

export default function PanoViewer({ scenes, floorplanUrl, initialScene = 0, onClose, propertyName, propertyAddress }) {
  const containerRef = useRef(null);
  const [currentIdx, setCurrentIdx] = useState(initialScene);
  const [sceneLabel, setSceneLabel] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [showFloorplan, setShowFloorplan] = useState(false);
  const [hotspotScreens, setHotspotScreens] = useState([]);
  const [bookmarked, setBookmarked] = useState(false);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const sphereRef = useRef(null);
  const textureRef = useRef(null);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const lonRef = useRef(0);
  const latRef = useRef(0);
  const animFrameRef = useRef(null);
  const hideTimerRef = useRef(null);
  const autoRotateRef = useRef(null);
  const dragDistance = useRef(0);
  const hotspotMarkersRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const walkAnimRef = useRef(null);
  const lastInteractionRef = useRef(Date.now());

  const currentScene = scenes?.[currentIdx];

  const updateHotspotScreens = useCallback(() => {
    if (!cameraRef.current || !containerRef.current) return;
    const camera = cameraRef.current;
    const container = containerRef.current;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const screens = hotspotMarkersRef.current.map((marker) => {
      const pos3D = marker.position.clone();
      const front = isInFront(pos3D, camDir);
      const proj = projectToScreen(pos3D, camera, container);
      return {
        id: marker.userData.hotspotId,
        x: proj.x,
        y: proj.y,
        visible: front && proj.visible,
      };
    });
    setHotspotScreens(screens);
  }, []);

  // ── Walking transition ──
  const walkToScene = useCallback((targetIdx) => {
    if (targetIdx === currentIdx) return;
    const startLon = lonRef.current;
    const startLat = latRef.current;
    const startTime = performance.now();
    const duration = 600;

    const animateWalk = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      lonRef.current = startLon + (0 - startLon) * eased;
      latRef.current = startLat + (0 - startLat) * eased;
      if (cameraRef.current) {
        const camera = cameraRef.current;
        const lon = lonRef.current;
        const lat = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, latRef.current));
        camera.lookAt(
          Math.cos(lat) * Math.cos(lon),
          Math.sin(lat),
          Math.cos(lat) * Math.sin(lon)
        );
      }
      if (t < 1) {
        walkAnimRef.current = requestAnimationFrame(animateWalk);
      } else {
        setCurrentIdx(targetIdx);
      }
    };
    setTransitioning(true);
    lastInteractionRef.current = Date.now();
    setShowUI(true);
    clearTimeout(hideTimerRef.current);
    walkAnimRef.current = requestAnimationFrame(animateWalk);
  }, [currentIdx]);

  // ── Init Three.js ──
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.SphereGeometry(5, 64, 32);
    const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.renderOrder = 0;
    scene.add(sphere);
    sphereRef.current = sphere;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      updateHotspotScreens();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(walkAnimRef.current);
      window.removeEventListener("resize", handleResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (textureRef.current) textureRef.current.dispose();
    };
  }, []);

  // ── Place 3D markers ──
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    hotspotMarkersRef.current.forEach(m => scene.remove(m));
    hotspotMarkersRef.current = [];
    const hotspots = currentScene?.hotspots || [];
    hotspots.forEach((h, i) => {
      if (h.target_scene == null) return;
      const pos3D = eqToSphere(h.x, h.y);
      const markerGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({ visible: false });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(pos3D);
      marker.userData = { hotspotId: i, targetScene: h.target_scene };
      scene.add(marker);
      hotspotMarkersRef.current.push(marker);
    });
    return () => {
      hotspotMarkersRef.current.forEach(m => scene.remove(m));
      hotspotMarkersRef.current = [];
    };
  }, [currentIdx, currentScene?.hotspots]);

  // ── Load texture ──
  useEffect(() => {
    const source = getSceneSource(currentScene);
    if (!source || !sphereRef.current) return;
    setLoading(true);
    setAssetError(false);
    setTransitioning(true);
    setSceneLabel(currentScene.title || `Pièce ${currentIdx + 1}`);

    const isHdr = isHdrSource(currentScene, source);
    const loader = isExrSource(currentScene, source)
      ? new EXRLoader()
      : isHdr ? new RGBELoader() : new THREE.TextureLoader();
    let disposed = false;
    if (rendererRef.current) {
      rendererRef.current.toneMapping = isHdr ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      rendererRef.current.toneMappingExposure = isHdr ? 1.05 : 1;
    }
    loader.load(
      source,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        if (textureRef.current) textureRef.current.dispose();
        if (isHdr && "LinearSRGBColorSpace" in THREE) {
          texture.colorSpace = THREE.LinearSRGBColorSpace;
        } else if (!isHdr) {
          texture.colorSpace = THREE.SRGBColorSpace;
        }
        textureRef.current = texture;
        sphereRef.current.material.map = texture;
        sphereRef.current.material.needsUpdate = true;
        lonRef.current = 0;
        latRef.current = 0;
        updateCamera();
        setLoading(false);
        setTimeout(() => setTransitioning(false), 300);
      },
      undefined,
      () => { if (!disposed) { setAssetError(true); setLoading(false); setTransitioning(false); } }
    );
    return () => { disposed = true; };
  }, [currentIdx, currentScene?.image_url, currentScene?.hdr_url, currentScene?.hdri_url, currentScene?.asset_type, currentScene?.format]);

  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const lon = lonRef.current;
    const lat = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, latRef.current));
    camera.position.set(0, 0, 0);
    camera.lookAt(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    );
  }, []);

  const startAutoRotate = useCallback(() => {
    clearInterval(autoRotateRef.current);
    autoRotateRef.current = setInterval(() => {
      if (!isDragging.current && Date.now() - lastInteractionRef.current > 4000) {
        lonRef.current += 0.0008;
        updateCamera();
      }
    }, 16);
  }, [updateCamera]);

  useEffect(() => {
    startAutoRotate();
    return () => clearInterval(autoRotateRef.current);
  }, [startAutoRotate]);

  // ── Pointer events ──
  const handlePointerDown = (e) => {
    e.preventDefault();
    clearInterval(autoRotateRef.current);
    isDragging.current = true;
    dragDistance.current = 0;
    lastInteractionRef.current = Date.now();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    prevMouse.current = { x: cx, y: cy };
    setShowUI(true);
    clearTimeout(hideTimerRef.current);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = cx - prevMouse.current.x;
    const dy = cy - prevMouse.current.y;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);
    lonRef.current -= dx * 0.004;
    latRef.current += dy * 0.004;
    latRef.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, latRef.current));
    updateCamera();
    prevMouse.current = { x: cx, y: cy };
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    hideTimerRef.current = setTimeout(() => setShowUI(false), 5000);
    setTimeout(() => {
      if (!isDragging.current) startAutoRotate();
    }, 4000);
  };

  const handleClick = (e) => {
    if (dragDistance.current > 5) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.touches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.touches ? e.changedTouches[0].clientY : e.clientY;
    const mouse = new THREE.Vector2();
    mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(hotspotMarkersRef.current);
    if (intersects.length > 0) {
      const targetScene = intersects[0].object.userData.targetScene;
      if (targetScene != null) {
        walkToScene(targetScene);
        return;
      }
    }
    setShowUI(s => !s);
    clearTimeout(hideTimerRef.current);
  };

  if (!currentScene) {
    return (
      <div className="fixed inset-0 z-[600] bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Layers className="w-8 h-8 text-white/20" />
        </div>
        <p className="text-white/40 text-[14px] font-medium">Aucune scène disponible</p>
        <button onClick={onClose}
          className="mt-2 bg-white/5 hover:bg-white/10 rounded-full px-6 py-3 border border-white/10 text-white/60 text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all">
          <X className="w-4 h-4 inline mr-2 -mt-0.5" /> Quitter la visite
        </button>
      </div>
    );
  }

  const hotspots = currentScene?.hotspots || [];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < scenes.length - 1;

  return (
    <div className="fixed inset-0 z-[600] bg-[#0a0a0f] select-none overflow-hidden font-display" style={{ touchAction: "none" }}>
      {/* Three.js canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onClick={handleClick}
      />

      {/* Vignette + gradient overlay */}
      <div className="absolute inset-0 pointer-events-none z-[5]"
        style={{ boxShadow: "inset 0 0 150px 60px rgba(0,0,0,0.5)" }} />
      <div className="absolute inset-0 pointer-events-none z-[5] bg-gradient-to-t from-black/60 via-transparent to-black/30" />

      {/* Transition flash */}
      <div className={`absolute inset-0 bg-black/40 z-[6] pointer-events-none transition-opacity duration-300 ${transitioning ? "opacity-100" : "opacity-0"}`} />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
            <div className="absolute inset-2 rounded-full bg-white/5 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white/80 animate-spin" />
            </div>
          </div>
        </div>
      )}

      {assetError && !loading && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none px-6">
          <div className="rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 px-5 py-4 text-center">
            <Layers className="w-7 h-7 text-white/50 mx-auto mb-2" />
            <p className="text-white text-[13px] font-black">Panorama HDR/HDRI/EXR indisponible</p>
            <p className="text-white/50 text-[11px] mt-1">Vérifiez que le fichier est un panorama équirectangulaire valide.</p>
          </div>
        </div>
      )}

      {/* ── TOP BAR (luxury) ── */}
      <div className={`absolute top-0 left-0 right-0 z-[40] transition-all duration-500 ${showUI ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}>
        <div className="mx-3 px-4 py-3 bg-black/40 backdrop-blur-2xl rounded-2xl border border-white/[0.08] flex items-center gap-3">
          {/* Property info */}
          <div className="flex-1 min-w-0">
            {propertyName && <p className="text-white text-[13px] font-black leading-tight truncate">{propertyName}</p>}
            {propertyAddress && <p className="text-white/40 text-[10px] font-medium truncate">{propertyAddress}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setBookmarked(b => !b)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${bookmarked ? "bg-primary/20 text-primary" : "text-white/50 hover:text-white/80"}`}>
              <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
            </button>
            <button onClick={() => {}} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white/80 transition-all active:scale-90">
              <Share2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-90">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Room label (centered top) ── */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 z-[40] transition-all duration-500 ${showUI && !showFloorplan ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
        style={{ paddingTop: "calc(76px + env(safe-area-inset-top, 0px))" }}>
        <div className="bg-black/40 backdrop-blur-2xl rounded-full px-5 py-2 border border-white/[0.06] flex items-center gap-3">
          <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">{currentIdx + 1}/{scenes.length}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span className="text-white/90 text-[13px] font-black">{sceneLabel}</span>
        </div>
      </div>

      {/* ── FLOORPLAN PANEL (right side) ── */}
      {floorplanUrl && (
        <>
          {/* Toggle button */}
          <button
            onClick={() => { setShowFloorplan(f => !f); setShowUI(true); clearTimeout(hideTimerRef.current); }}
            className={`absolute z-[40] transition-all duration-400 ${showUI || showFloorplan ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
            style={{ top: "calc(80px + env(safe-area-inset-top, 0px))", right: 16 }}>
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-all active:scale-95 ${showFloorplan ? "bg-primary/80 border-primary text-white shadow-lg shadow-primary/20" : "bg-black/40 backdrop-blur-2xl border-white/[0.08] text-white/60 hover:text-white/90"}`}>
              <Map className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-wider">Plan</span>
            </div>
          </button>

          {/* Floorplan panel */}
          <div className={`absolute right-0 z-[38] transition-all duration-500 ease-out ${showFloorplan ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"}`}
            style={{ top: "calc(130px + env(safe-area-inset-top, 0px))", bottom: "calc(110px)" }}>
            <div className="h-full w-[min(75vw,280px)] bg-black/60 backdrop-blur-3xl rounded-l-3xl border border-white/[0.06] border-r-0 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-white/[0.04]">
                <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">Plan 2D</span>
              </div>
              <div className="flex-1 relative">
                <BeautyImage src={floorplanUrl} alt="Plan 2D" className="absolute inset-0 w-full h-full object-contain p-2" />
                {scenes.map((s, i) => {
                  const fx = s.floor_x ?? 50;
                  const fy = s.floor_y ?? 50;
                  return (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); walkToScene(i); }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group"
                      style={{ left: `${fx}%`, top: `${fy}%` }}
                    >
                      <span className={`block rounded-full transition-all duration-300 ${i === currentIdx ? "w-4 h-4 bg-primary border-2 border-white shadow-lg shadow-primary/40" : "w-3 h-3 bg-white/50 border border-white/20 hover:bg-white hover:scale-125"}`} />
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                        {s.title || `Pièce ${i + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Navigation arrows (subtle, elegant) ── */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); walkToScene(currentIdx - 1); }}
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-[40] w-12 h-12 bg-black/30 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/[0.06] active:scale-90 transition-all duration-500 hover:bg-black/50 hover:border-white/[0.12] ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <ChevronLeft className="w-5 h-5 text-white/80" strokeWidth={1.5} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); walkToScene(currentIdx + 1); }}
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-[40] w-12 h-12 bg-black/30 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/[0.06] active:scale-90 transition-all duration-500 hover:bg-black/50 hover:border-white/[0.12] ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <ChevronRight className="w-5 h-5 text-white/80" strokeWidth={1.5} />
        </button>
      )}

      {/* ── Hotspots (Matterport-style glowing rings) ── */}
      {hotspots.map((h, i) => {
        if (h.target_scene == null) return null;
        const screen = hotspotScreens[i];
        const targetTitle = scenes[h.target_scene]?.title || `Pièce ${h.target_scene + 1}`;
        const visible = screen?.visible ?? false;
        return (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); walkToScene(h.target_scene); }}
            className="absolute z-[35] group active:scale-90"
            style={{
              left: screen?.x ?? -9999,
              top: screen?.y ?? -9999,
              transform: "translate(-50%, -50%)",
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? "auto" : "none",
              transition: "opacity 0.25s ease",
            }}
          >
            {/* Outer glow ring */}
            <div className="absolute inset-0 w-14 h-14 -m-3 rounded-full border border-white/20 animate-ping" style={{ animationDuration: "2s" }} />
            {/* Solid ring */}
            <div className="absolute inset-0 w-10 h-10 -m-1 rounded-full border-2 border-white/60" />
            {/* Inner circle */}
            <div className="relative w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            </div>
            {/* Label */}
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl text-white text-[10px] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl border border-white/[0.06]">
              <Move className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />
              {targetTitle}
            </div>
          </button>
        );
      })}

      {/* ── BOTTOM CAROUSEL (luxury thumbnails with room names) ── */}
      <div className={`absolute bottom-0 left-0 right-0 z-[40] transition-all duration-500 ${showUI ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
        <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-10 pb-5 px-4"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="flex items-end justify-center gap-2 overflow-x-auto hide-scrollbar pb-1"
            style={{ scrollSnapType: "x mandatory" }}>
            {scenes.map((s, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); walkToScene(i); }}
                style={{ scrollSnapAlign: "center" }}
                className={`shrink-0 flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-95 group ${
                  i === currentIdx ? "scale-110" : ""
                }`}
              >
                {/* Thumbnail */}
                <div className={`relative w-[72px] h-[52px] rounded-xl overflow-hidden transition-all duration-300 ${
                  i === currentIdx
                    ? "ring-1 ring-white/80 shadow-[0_0_24px_rgba(255,255,255,0.12)]"
                    : "opacity-50 ring-1 ring-white/[0.06] hover:opacity-80 hover:ring-white/[0.15]"
                }`}>
                  {getSceneSource(s) && !isHdrSource(s, getSceneSource(s)) ? (
                    <BeautyImage src={s.image_url} alt={s.title || ""} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-cyan-950 to-blue-900 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-cyan-200/80" />
                    </div>
                  )}
                  {i === currentIdx && (
                    <div className="absolute inset-0 bg-primary/10" />
                  )}
                </div>
                {/* Room name */}
                <span className={`text-[10px] font-bold transition-all duration-300 whitespace-nowrap max-w-[80px] truncate ${
                  i === currentIdx ? "text-white" : "text-white/30"
                }`}>
                  {s.title || `Pièce ${i + 1}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Touch hint ── */}
      <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 z-[35] transition-all duration-700 pointer-events-none ${showUI ? "opacity-100" : "opacity-0"}`}>
        <div className="bg-white/[0.04] backdrop-blur-md rounded-full px-4 py-2 border border-white/[0.04] flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white/60" />
          </span>
          <span className="text-white/30 text-[10px] font-medium">Faites glisser pour explorer</span>
        </div>
      </div>
    </div>
  );
}
