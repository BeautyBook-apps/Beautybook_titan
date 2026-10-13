import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { AlertCircle, Box, Loader2 } from "lucide-react";

const getSource = asset => asset?.preview_url || asset?.url || "";
const isExr = asset => asset?.format === "exr" || /\.exr(?:$|[?#])/i.test(getSource(asset));

/**
 * Small equirectangular preview used in the admin form. HDR/HDRI/EXR files
 * cannot be displayed with an <img>, so they are decoded in Three.js and
 * shown on the inside of a sphere with a gentle automatic rotation.
 */
export default function HdrAssetPreview({ asset }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const container = containerRef.current;
    const source = getSource(asset);
    if (!container || !source) {
      setStatus("missing");
      return undefined;
    }

    let disposed = false;
    let frameId;
    let renderer;
    let geometry;
    let material;
    let texture;

    try {
      const width = Math.max(container.clientWidth, 240);
      const height = Math.max(container.clientHeight, 150);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
      camera.position.set(0, 0, 0.01);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      container.appendChild(renderer.domElement);

      geometry = new THREE.SphereGeometry(5, 48, 24);
      material = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);

      const loader = isExr(asset) ? new EXRLoader() : new RGBELoader();
      loader.load(
        source,
        loadedTexture => {
          if (disposed) {
            loadedTexture.dispose();
            return;
          }
          texture = loadedTexture;
          texture.colorSpace = THREE.LinearSRGBColorSpace || THREE.SRGBColorSpace;
          material.map = texture;
          material.needsUpdate = true;
          setStatus("ready");
        },
        undefined,
        () => {
          if (!disposed) setStatus("error");
        },
      );

      const render = () => {
        if (disposed) return;
        frameId = window.requestAnimationFrame(render);
        sphere.rotation.y += 0.0009;
        renderer.render(scene, camera);
      };
      render();

      return () => {
        disposed = true;
        if (frameId) window.cancelAnimationFrame(frameId);
        texture?.dispose();
        material?.dispose();
        geometry?.dispose();
        renderer?.dispose();
        if (renderer?.domElement?.parentNode === container) container.removeChild(renderer.domElement);
      };
    } catch {
      setStatus("error");
      return () => { disposed = true; };
    }
  }, [asset]);

  return (
    <div ref={containerRef} className="relative h-44 overflow-hidden rounded-2xl bg-slate-950">
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-white">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
          <span className="text-[10px] font-bold">Prévisualisation…</span>
        </div>
      )}
      {(status === "error" || status === "missing") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-white">
          {status === "error" ? <AlertCircle className="h-7 w-7 text-amber-300" /> : <Box className="h-7 w-7 text-cyan-300" />}
          <span className="text-[10px] font-bold text-white/80">
            {status === "error" ? "Aperçu 3D indisponible" : "Fichier importé"}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
        <p className="truncate text-[11px] font-black text-white">{asset?.name || "Panorama HDR"}</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">{String(asset?.format || "hdr").toUpperCase()} · aperçu 360°</p>
      </div>
    </div>
  );
}
