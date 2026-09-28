import BeautyImage from '@/components/ui/BeautyImage';
import { fetchShopifyProducts } from "@/api/shopifyClient";
import { useState, useEffect, useRef } from "react";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ArrowLeft, Plus, Heart, Trash2, X, Music,
  SlidersHorizontal, Wand2, RotateCcw, AlignJustify,
  Play, Pause, Globe, Lock, ShoppingBag, CheckCircle2,
  Video, Camera, Clock, Sun, Contrast, Droplets,
  Check, Upload, ChevronLeft, ChevronRight, Star,
  Square, Timer, LayoutGrid, Sparkles, Lightbulb,
  ScanLine, Maximize2, Type, MessageSquare, Share2,
  Scissors, BookOpen, RefreshCw, Scan, Clapperboard, GripVertical, Images,
  Hourglass, Grid3x3, Palette, Crop, MoveVertical, Feather,
  Zap, Aperture, Focus, Circle, Box, Film
} from "lucide-react";
import { entities, uploadFile } from '@/api/entities';


import apiClient from '@/lib/apiClient';
import { supabase } from '@/api/supabaseClient';
import VideoEditor from "@/components/studio/VideoEditor";
import SoundLibrary from "@/components/studio/SoundLibrary";
import EditeurPhotos from "@/components/studio/EditeurPhotos";
import AutoCut from "@/components/studio/AutoCut";
import Legendes from "@/components/studio/Legendes";
import Detourage from "@/components/studio/Detourage";
import { useTheme } from "@/hooks/useTheme";

const categories = ["Tous", "Coiffure", "Maquillage", "Ongles", "Soin", "Avant/Après", "Promo"];
const HASHTAGS = ["#BEAUTÉ", "#COIFFURE", "#STYLE", "#PROFESSIONNEL", "#SALON", "#MODE", "#CHEVEUX", "#SOIN"];
const PUB_TYPES = [
  { id: "reel", label: "RÉEL", icon: Play, color: "text-primary" },
  { id: "tuto", label: "TUTO", icon: Video, color: "text-blue-500" },
  { id: "conseil", label: "CONSEIL", icon: Lightbulb, color: "text-yellow-500" },
];

// ─── Step indicator bar ───────────────────────────────────────────────────────
function StepBar({ step, total, label, isDark = false }) {
  return (
    <div className={`px-5 pt-4 pb-0 ${isDark ? "bg-[#0a0a14]" : "bg-white"}`}>
      <div className="flex gap-1 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1 rounded-full flex-1 transition-all ${i < step ? "bg-primary" : isDark ? "bg-white/10" : "bg-gray-200"}`} />
        ))}
      </div>
      <div className={`flex items-center justify-between pb-4 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
        <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}>Étape {step}/{total}</p>
        <p className={`text-[13px] font-black uppercase tracking-widest ${isDark ? "text-white" : "text-gray-900"}`}>{label}</p>
        <div className="w-16" />
      </div>
    </div>
  );
}

// ─── Image Slider Preview ─────────────────────────────────────────────────────
function ImageSlider({ images, style = {} }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
      <Camera className="w-16 h-16 text-white/20" />
      <p className="text-white/40 text-[13px] font-black uppercase tracking-widest">Ajoutez des photos</p>
    </div>
  );
  return (
    <div className="relative w-full h-full">
      <BeautyImage src={images[idx]} alt="" className="w-full h-full object-cover" style={style} />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setIdx(i => Math.min(images.length - 1, i + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <div key={i} className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`} />
            ))}
          </div>
          <div className="absolute top-3 right-3 bg-black/50 rounded-full px-2 py-1">
            <span className="text-white text-[10px] font-black">{idx + 1}/{images.length}</span>
          </div>
        </>
      )}
    </div>
  );
}

const DRAFT_KEY = "bb_studio_draft";

// ─── Wizard ───────────────────────────────────────────────────────────────────
function PublicationWizard({ onClose, onPublish, onDraft, editData }) {
  const { theme } = useTheme();
  const isDark = true; // Studio toujours en mode sombre
  const stepIsDark = theme === "dark" || theme === "night"; // Steps 2-5 suivent le thème
  const [step, setStep] = useState(1);

  // Mapper les données DB → formulaire
  const mapPubToForm = (pub) => {
    if (!pub) return null;
    const categoryToPubType = { "Réels": "reel", "Tutos": "tuto", "Conseils": "conseil" };
    return {
      title: pub.title || "",
      caption: pub.description || pub.title || "",
      category: pub.category || "Coiffure",
      images: pub.images || (pub.thumbnail_url ? [pub.thumbnail_url] : []),
      hashtags: pub.hashtags || [],
      pubType: categoryToPubType[pub.category] || pub.pub_type || "reel",
      visibility: pub.visibility || "public",
      sound: pub.sound || null,
      soundPreviewUrl: pub.sound_preview_url || null,
      soundDuration: pub.sound_duration || 0,
      soundTrimStart: pub.sound_trim_start || 0,
      soundTrimEnd: pub.sound_trim_end || 1,
      brightness: pub.brightness || 100,
      contrast: pub.contrast || 100,
      saturation: pub.saturation || 100,
      filter: pub.filter || null,
      rotation: pub.rotation || 0,
      duration: pub.duration || 15,
      script: pub.script || "",
      video_url: pub.video_url || null,
      product_id: pub.product_id || null,
      product_name: pub.product_name || null,
      product_img: pub.product_img || null,
      service_id: pub.service_id || null,
      service_name: pub.service_name || null,
    };
  };

  // Restaurer le brouillon local si disponible, ou utiliser editData
  const savedDraft = (() => {
    if (editData) return mapPubToForm(editData);
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
  })();

  const [form, setForm] = useState(savedDraft || {
    title: "",
    caption: "",
    category: "Coiffure",
    images: [],
    hashtags: [],
    pubType: "reel",
    visibility: "public",
    sound: null,
    soundPreviewUrl: null,
    soundDuration: 0,
    soundTrimStart: 0,
    soundTrimEnd: 1,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    filter: null,
    rotation: 0,
    duration: 15,
    script: "",
    product_id: null,
    product_name: null,
    product_img: null,
    service_id: null,
    service_name: null,
  });

  const [activePanel, setActivePanel] = useState(null);
  const [videoEditorResult, setVideoEditorResult] = useState(null); // résultat du montage appliqué
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0); // image active dans le slider du studio
  const [previewIdx, setPreviewIdx] = useState(0); // index slider dans la prévisualisation step 2
  const [uploading, setUploading] = useState(false);
  // Listes en lecture seule : affichage direct depuis le cache (clé globale,
  // ces listes ne dépendent pas de l'utilisateur), rafraîchissement en arrière-plan.
  const [produits, setProduits] = useCachedState("publication_options", [], c => c?.produits || []);
  const [services, setServices] = useCachedState("publication_options", [], c => c?.services || []);
  const [linkedType, setLinkedType] = useState(null);
  const [showProductList, setShowProductList] = useState(false);
  const [showServiceList, setShowServiceList] = useState(false);
  const [recordingMode, setRecordingMode] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [videoThumb, setVideoThumb] = useState(null); // thumbnail capturée de la vidéo importée
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const videoRef = useRef(null);
  const previewContainerRef = useRef(null);
  const previewAudioRef = useRef(null); // audio pour la musique jouée sur la vidéo preview
  const trimBarRef = useRef(null); // ref pour la barre de trim audio
  const [showAudioMixer, setShowAudioMixer] = useState(false);
  const [originalVolume, setOriginalVolume] = useState(100);
  const [originalMuted, setOriginalMuted] = useState(false);
  const [addedVolume, setAddedVolume] = useState(70);
  const [addedMuted, setAddedMuted] = useState(false);
  const [addedPlaying, setAddedPlaying] = useState(false);
  const [textPos, setTextPos] = useState({ x: 30, y: 200 });
  const textDragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerCount, setTimerCount] = useState(0);
  const timerIntervalRef = useRef(null);
  const [allMedia, setAllMedia] = useState([]); // [{url, type:"image"|"video", name}]
  const [activeTrackClips, setActiveTrackClips] = useState([]); // clips for multi-track editor
  const [showTrackEditor, setShowTrackEditor] = useState(false);
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [autoSlide, setAutoSlide] = useState(true);
  const autoSlideRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    // Charger produits BDD + Shopify fusionnés, et services
    Promise.allSettled([
      entities.Produit.filter({ status: "actif" }, "-created_at", 200).catch(() => []),
      fetchShopifyProducts({}).then(r =>
        (r.data?.products || []).map(p => ({
          id: p.id, name: p.name, price: p.price, image_url: p.img,
          brand: p.brand, source: "shopify",
        }))
      ),
    ]).then(([dbRes, shopifyRes]) => {
      const db = dbRes.status === "fulfilled" ? dbRes.value : [];
      const shopify = shopifyRes.status === "fulfilled" ? shopifyRes.value : [];
      const merged = [...db, ...shopify];
      setProduits(merged);
      mergePageCache("publication_options", { produits: merged });
    });
    entities.Service.list("-created_at", 20).then(data => {
      setServices(data || []);
      mergePageCache("publication_options", { services: data || [] });
    }).catch(() => {});
  }, []);

  // Sauvegarde automatique dans localStorage à chaque changement du form
  useEffect(() => {
    const hasContent = form.images.length > 0 || form.video_url || form.script || form.caption;
    if (hasContent) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }
  }, [form]);

  // Timer countdown effect
  useEffect(() => {
    if (showTimer && !isVideoPaused && (form.video_url || form.images.length > 0)) {
      setTimerCount(form.duration);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimerCount(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            if (videoRef.current) videoRef.current.pause();
            setIsVideoPaused(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [showTimer, isVideoPaused]);

  // Auto-slide images when multiple images are imported
  useEffect(() => {
    if (autoSlide && form.images.length > 1 && isVideoPaused && !showVideoEditor && !showTrackEditor) {
      const interval = Math.max(2000, (form.duration || 5) * 1000);
      autoSlideRef.current = setInterval(() => {
        setActiveImageIdx(prev => (prev + 1) % form.images.length);
      }, interval);
    }
    return () => { if (autoSlideRef.current) clearInterval(autoSlideRef.current); };
  }, [autoSlide, form.images.length, isVideoPaused, showVideoEditor, showTrackEditor, form.duration]);

  // Reset image index when images change
  useEffect(() => {
    setActiveImageIdx(0);
  }, [form.images.length]);

  const FILTERS = [
    { id: null, label: "Normal", style: {} },
    { id: "grayscale", label: "N&B", style: { filter: "grayscale(100%)" } },
    { id: "sepia", label: "Sépia", style: { filter: "sepia(80%)" } },
    { id: "warm", label: "Chaud", style: { filter: "saturate(150%) hue-rotate(-20deg)" } },
    { id: "cool", label: "Froid", style: { filter: "saturate(120%) hue-rotate(30deg)" } },
    { id: "vivid", label: "Vivid", style: { filter: "saturate(200%) contrast(110%)" } },
  ];

  // Utilise le résultat du montage vidéo si disponible, sinon les réglages du formulaire
  const getImageStyle = () => {
    const src = videoEditorResult || form;
    const FILTER_CSS = {
      grayscale: "grayscale(100%)",
      sepia: "sepia(80%)",
      warm: "saturate(150%) hue-rotate(-20deg)",
      cool: "saturate(120%) hue-rotate(30deg)",
      vivid: "saturate(200%) contrast(110%)",
    };
    return {
      filter: [
        src.filter ? (FILTER_CSS[src.filter] || FILTERS.find(f => f.id === src.filter)?.style?.filter || "") : "",
        `brightness(${src.brightness || 100}%)`,
        `contrast(${src.contrast || 100}%)`,
        `saturate(${src.saturation || 100}%)`,
      ].filter(Boolean).join(" "),
      transform: `scaleX(${src.flipH ? -1 : 1}) rotate(${src.rotation || 0}deg)`,
      transition: "all 0.3s ease",
    };
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    try {
      for (const file of files) {
        const { file_url } = await uploadFile({ file });
        urls.push(file_url);
      }
      setForm(f => ({ ...f, images: [...f.images, ...urls] }));
      // Ajouter à allMedia pour le suivi multi-pistes
      const newMedia = urls.map((url, i) => ({ url, type: "image", name: files[i]?.name || `image_${Date.now()}`, id: `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}_${i}` }));
      setAllMedia(prev => [...prev, ...newMedia]);
      // Si total médias > 1, proposer l'éditeur multi-pistes
      const totalMedia = urls.length + (form.video_url ? 1 : 0) + form.images.length;
      if (totalMedia > 1) {
        setTimeout(() => setShowTrackEditor(true), 300);
      }
    } catch (err) {
      console.error('[handleFileChange] Upload failed:', err);
      alert("L'upload a échoué. Vérifiez la taille du fichier.");
    }
    setUploading(false);
  };

  // Capture une miniature d'une vidéo via canvas
  const captureVideoThumb = (url) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.src = url;
    video.currentTime = 0.5;
    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 120; canvas.height = 160;
        canvas.getContext("2d").drawImage(video, 0, 0, 120, 160);
        setVideoThumb(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        // CORS restriction — use a generic video icon placeholder
        setVideoThumb("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160'><rect width='120' height='160' fill='%231a2035'/><polygon points='45,55 45,105 90,80' fill='%23E8732A'/></svg>");
      }
    }, { once: true });
    video.addEventListener("error", () => {}, { once: true });
    video.load();
  };

  const handleVideoFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const uploadedUrls = [];
    try {
      for (const file of files) {
        const localUrl = URL.createObjectURL(file);
        if (uploadedUrls.length === 0) captureVideoThumb(localUrl);
        const { file_url } = await uploadFile({ file });
        uploadedUrls.push({ url: file_url, type: "video", name: file.name });
      }
      // Si 1 seule vidéo → comportement classique
      if (uploadedUrls.length === 1) {
        setForm(f => ({
          ...f,
          video_url: uploadedUrls[0].url,
          images: f.images.length === 0 ? [] : f.images,
        }));
      } else {
        // Plusieurs médias → ajouter à allMedia et ouvrir l'éditeur multi-pistes
        const newMedia = uploadedUrls.map(u => ({ ...u, id: `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }));
        setAllMedia(prev => [...prev, ...newMedia]);
        setForm(f => ({
          ...f,
          video_url: uploadedUrls[0].url,
          images: f.images.length === 0 ? [] : f.images,
        }));
        // Auto-ouvrir l'éditeur multi-pistes
        setTimeout(() => setShowTrackEditor(true), 300);
      }
    } catch (err) {
      console.error('[handleVideoFileChange] Upload failed:', err);
      alert("L'upload de la vidéo a échoué. Vérifiez la taille du fichier.");
    }
    setUploading(false);
    setRecordingMode(null);
  };

  // Charger la source audio quand la musique change (avec trim)
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (form.soundPreviewUrl) {
      audio.src = form.soundPreviewUrl;
      audio.volume = addedMuted ? 0 : addedVolume / 100;
      audio.loop = false;
      // Détecter la durée
      const handleLoaded = () => {
        const dur = audio.duration || 0;
        if (dur > 0 && form.soundDuration === 0) {
          setForm(f => ({ ...f, soundDuration: dur, soundTrimEnd: dur }));
        }
      };
      audio.addEventListener("loadedmetadata", handleLoaded);
      // Appliquer le trim start
      const startTime = form.soundTrimStart || 0;
      if (startTime > 0) audio.currentTime = startTime;
      // Auto-play avec la vidéo quand un son est sélectionné
      if (form.video_url) {
        const v = videoRef.current;
        if (v && isVideoPaused) {
          v.play().catch(() => {});
          setIsVideoPaused(false);
        }
        audio.play().catch(() => {});
        setAddedPlaying(true);
      }
      return () => audio.removeEventListener("loadedmetadata", handleLoaded);
    } else {
      audio.pause();
      audio.src = "";
      setAddedPlaying(false);
      setForm(f => ({ ...f, soundDuration: 0, soundTrimStart: 0, soundTrimEnd: 0 }));
    }
  }, [form.soundPreviewUrl]);

  // Loop audio dans la zone trim
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      if (form.soundTrimEnd > 0 && audio.currentTime >= form.soundTrimEnd) {
        audio.currentTime = form.soundTrimStart || 0;
      }
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [form.soundTrimStart, form.soundTrimEnd]);

  // Sync volume ajouté en temps réel
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (audio) audio.volume = addedMuted ? 0 : addedVolume / 100;
  }, [addedVolume, addedMuted]);

  // Sync volume original en temps réel
  useEffect(() => {
    const v = videoRef.current;
    if (v && !originalMuted) v.volume = originalVolume / 100;
  }, [originalVolume, originalMuted]);

  const startCameraRecording = async (mode) => {
    setRecordingMode(mode);
    chunksRef.current = [];
    try {
      const constraints = {
        video: {
          facingMode: cameraFacing,
          width: mode === "portrait" ? { ideal: 720 } : { ideal: 1280 },
          height: mode === "portrait" ? { ideal: 1280 } : { ideal: 720 },
        },
        audio: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Accès caméra refusé : " + err.message);
      setRecordingMode(null);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingMode(null);
  };

  const toggleRecord = () => {
    if (!streamRef.current) return;
    if (!isRecording) {
      chunksRef.current = [];
      const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp8" });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], "video.webm", { type: "video/webm" });
        setUploading(true);
        stopCamera();
        try {
          const { file_url } = await uploadFile({ file });
          setForm(f => ({
            ...f,
            video_url: file_url,
            images: f.images.length === 0 ? [file_url] : f.images,
          }));
        } catch (err) {
          console.error('[toggleRecord] Upload failed:', err);
          alert("L'upload de la vidéo a échoué.");
        }
        setUploading(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  const flipCamera = async () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(newFacing);
    if (streamRef.current && recordingMode) {
      streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    }
  };

  const removeImage = (idx) => {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const toggleHashtag = (tag) => {
    setForm(f => ({
      ...f,
      hashtags: f.hashtags.includes(tag) ? f.hashtags.filter(h => h !== tag) : [...f.hashtags, tag],
    }));
  };

  const next = () => {
    if (step === 2) {
      if (!form.caption.trim()) { alert("La légende est obligatoire."); return; }
      if (form.hashtags.length === 0) { alert("Ajoutez au moins un hashtag."); return; }
    }
    setStep(s => Math.min(s + 1, 5));
  };
  const back = () => setStep(s => Math.max(s - 1, 1));
  const draft = () => { localStorage.removeItem(DRAFT_KEY); onDraft({ ...form, status: "brouillon", _editId: editData?.id || null }); };
  const publish = () => { localStorage.removeItem(DRAFT_KEY); onPublish({ ...form, status: "publie", _editId: editData?.id || null }); };

  // Fermeture propre : sauvegarder comme brouillon DB + nettoyer médias
  const handleClose = async () => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ""; }
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = ""; }
    // Sauvegarder en DB si du contenu existe
    const hasContent = form.images.length > 0 || form.video_url || form.script || form.caption;
    if (hasContent) {
      onDraft({ ...form, status: "brouillon" });
    } else {
      onClose();
    }
  };

  const bottomBar = (showBack = true) => (
    <div className={`px-5 py-4 border-t flex items-center gap-3 ${stepIsDark ? "bg-[#0a0a14] border-white/10" : "bg-white border-gray-100"}`}>
      <button onClick={draft} className={`px-5 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all ${stepIsDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-600"}`}>
        Brouillon
      </button>
      {showBack && (
        <button onClick={back} className={`px-5 py-3.5 text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all ${stepIsDark ? "text-white/60" : "text-gray-600"}`}>
          Retour
        </button>
      )}
      <button
        onClick={step === 5 ? publish : next}
        className="flex-1 bg-primary text-white font-black text-[14px] uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        {step === 5 ? "Publier ✦" : "Continuer →"}
      </button>
    </div>
  );

  // ── STEP 1: Studio (style TikTok) ───────────────────────────────────────────
  const CAPTURE_MODES = [
    { id: "video", label: "VIDÉO" },
    { id: "photo", label: "PHOTO" },
    { id: "texte", label: "TEXTE" },
    { id: "creer", label: "CRÉER" },
  ];
  const [captureMode, setCaptureMode] = useState("video");

  // Pause/Play synchronisé vidéo + audio
  const toggleVideoPlayback = () => {
    const v = videoRef.current;
    const a = previewAudioRef.current;
    if (!v) return;
    if (isVideoPaused) {
      v.play().catch(() => {});
      if (a && form.soundPreviewUrl) {
        a.currentTime = form.soundTrimStart || 0;
        a.play().catch(() => {});
      }
      setIsVideoPaused(false);
    } else {
      v.pause();
      if (a) a.pause();
      setIsVideoPaused(true);
    }
  };

  // Pause automatique quand on entre dans le mode CRÉER — ouvre directement l'éditeur montage
  const handleSetCaptureMode = (mode) => {
    if (mode === "creer") {
      videoRef.current?.pause();
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setIsVideoPaused(true);
      if (form.video_url || form.images.length > 0) {
        if (form.images.length > 1 && !form.video_url) { setShowTrackEditor(true); }
        else { setShowVideoEditor(true); }
      }
      return;
    } else if (mode !== "creer" && isVideoPaused && videoRef.current) {
      videoRef.current.play().catch(() => {});
      if (previewAudioRef.current && form.soundPreviewUrl) previewAudioRef.current.play().catch(() => {});
      setIsVideoPaused(false);
    }
    setCaptureMode(mode);
  };
  const [showSoundPanel, setShowSoundPanel] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef = useRef(null);
  // Fond texte
  const TEXT_BACKGROUNDS = [
    { id: "noir", label: "Noir", bg: "bg-black", text: "text-white" },
    { id: "blanc", label: "Blanc", bg: "bg-white", text: "text-gray-900" },
    { id: "primary", label: "Orange", bg: "bg-primary", text: "text-white" },
    { id: "violet", label: "Violet", bg: "bg-purple-700", text: "text-white" },
    { id: "rose", label: "Rose", bg: "bg-pink-500", text: "text-white" },
    { id: "vert", label: "Vert", bg: "bg-emerald-600", text: "text-white" },
  ];
  const [textBg, setTextBg] = useState("noir");

  // Chronomètre pendant enregistrement
  const startTimer = () => {
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
  };
  const stopTimer = () => {
    clearInterval(recTimerRef.current);
    setRecSeconds(0);
  };
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Charger sons au montage — recherche iTunes par défaut "beauty"
  const hasMedia = form.video_url || form.images.length > 0;

  // ── Retour anticipé : VideoEditor plein écran ──
  if (showVideoEditor) {
    return createPortal(
      <VideoEditor
        videoUrl={form.video_url || (form.images[0] ?? null)}
        sound={form.sound}
        soundUrl={form.soundPreviewUrl}
        onClose={() => setShowVideoEditor(false)}
        onAddSound={({ name, url, file }) => {
          setForm(f => ({ ...f, sound: name, soundPreviewUrl: url }));
        }}
        onRemoveSound={() => setForm(f => ({ ...f, sound: null, soundPreviewUrl: null }))}
        onDone={(edits) => {
          setForm(f => ({
            ...f,
            ...edits,
            soundPreviewUrl: edits.soundUrl || f.soundPreviewUrl,
          }));
          setVideoEditorResult(edits);
          if (edits.originalSoundRemoved) {
            setOriginalMuted(true);
            if (videoRef.current) videoRef.current.muted = true;
          }
          setShowVideoEditor(false);
        }}
      />,
      document.body
    );
  }

  if (step === 1) return (
    <div className="fixed inset-0 z-50 flex flex-col font-display" style={{ height: "100dvh", backgroundColor: hasMedia ? "transparent" : "#000000" }}>
      {/* Audio preview pour la musique sur vidéo */}
      <audio ref={previewAudioRef} loop />

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      <input ref={photoInputRef} type="file" accept="image/*" capture="camera" className="hidden" onChange={handleFileChange} />
      <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVideoFileChange} />

      {/* Vue caméra live — thème */}
      {recordingMode && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ backgroundColor: "transparent" }} />
          <div className="absolute top-5 left-5 right-5 flex items-center justify-between z-10">
            <button onClick={stopCamera} className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
            {isRecording && (
              <span className="bg-red-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-500/30">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> REC
              </span>
            )}
            <button onClick={flipCamera} className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>
          {/* Chronomètre pendant l'enregistrement */}
          {isRecording && (
            <div className="absolute top-20 left-0 right-0 flex justify-center z-10">
              <div className="bg-red-500/90 backdrop-blur-sm text-white font-black text-[18px] px-6 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-red-500/30">
                <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                {formatTime(recSeconds)}
              </div>
            </div>
          )}
          <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 z-10">
            <button onClick={() => {
              if (!isRecording) startTimer(); else stopTimer();
              toggleRecord();
            }}
              className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all active:scale-95 ${isRecording ? "border-red-400 shadow-lg shadow-red-500/30" : "border-white"}`}>
              {isRecording
                ? <div className="w-8 h-8 bg-red-500 rounded-lg shadow-lg" />
                : <div className="w-14 h-14 rounded-full bg-white" />
              }
            </button>
            <span className="text-white/60 text-[11px] font-black uppercase tracking-widest">
              {isRecording ? "Appuyer pour arrêter" : "Appuyer pour enregistrer"}
            </span>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="text-white text-[14px] font-black flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                Envoi en cours...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sound panel overlay — thème */}
      {showSoundPanel && (
        <SoundLibrary
          onClose={() => setShowSoundPanel(false)}
          selectedKey={form.sound}
          onPick={(tr) => {
            setForm((f) => ({ ...f, sound: `${tr.title} - ${tr.artist}`, soundPreviewUrl: tr.previewUrl || null }));
          }}
          onImport={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "audio/*";
            input.onchange = async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { file_url } = await uploadFile({ file });
                if (file_url) {
                  setForm((f) => ({ ...f, sound: file.name.replace(/\.[^.]+$/, ""), soundPreviewUrl: file_url }));
                  setShowSoundPanel(false);
                }
              } catch (err) { alert(err.message || "Import impossible"); }
            };
            input.click();
          }}
        />
      )}

      {/* Fond : preview avec styles appliqués sur vidéo ET image */}
      <div ref={previewContainerRef} className="absolute inset-0" style={{ backgroundColor: "#000000", ...(form.aspectRatio ? {
        aspectRatio: (() => {
          const map = { "1:1": "1/1", "4:5": "4/5", "9:16": "9/16", "16:9": "16/9", "4:3": "4/3", "3:4": "3/4" };
          return map[form.aspectRatio] || "auto";
        })(),
        maxWidth: "100%",
        maxHeight: "100%",
        margin: "auto",
      } : {})}}>
        {captureMode === "texte" && !form.video_url && form.images.length === 0 ? (
          // Mode texte : fond coloré
          <div className={`w-full h-full flex flex-col items-center justify-center ${TEXT_BACKGROUNDS.find(b => b.id === textBg)?.bg || "bg-black"}`}>
            {form.script ? (
              <p className={`text-[28px] font-black text-center px-8 leading-snug ${TEXT_BACKGROUNDS.find(b => b.id === textBg)?.text || "text-white"}`}>
                {form.script}
              </p>
            ) : (
              <p className="text-white/30 text-[16px] font-black text-center px-8">Tapez votre texte ci-dessous...</p>
            )}
          </div>
        ) : form.video_url ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={form.video_url}
              autoPlay loop playsInline
              muted={originalMuted}
              className="w-full h-full"
              style={{
                ...getImageStyle(),
                objectFit: form.objectFit || "cover",
                visibility: showVideoEditor ? "hidden" : "visible",
                opacity: 1,
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) videoRef.current.volume = originalVolume / 100;
              }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); toggleVideoPlayback(); }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              {isVideoPaused && (
                <div className="w-16 h-16 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
              )}
            </button>
            {/* Son original badge */}
            {form.sound && (
              <div onClick={(e) => { e.stopPropagation(); setShowAudioMixer(true); }} className="absolute top-14 left-4 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 active:scale-95 transition-all cursor-pointer">
                <Music className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-white text-[11px] font-black truncate max-w-[120px]">{form.sound.split(" - ")[0]}</span>
                <button onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, sound: null, soundPreviewUrl: null, soundDuration: 0, soundTrimStart: 0, soundTrimEnd: 0 })); if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = ""; } setAddedPlaying(false); }}>
                  <X className="w-3 h-3 text-white/60" />
                </button>
              </div>
            )}
          </div>
        ) : form.images.length > 0 ? (
          <div className="relative w-full h-full">
            <BeautyImage
              src={form.images[activeImageIdx]}
              alt=""
              className="w-full h-full object-cover"
              style={getImageStyle()}
            />
            {/* Son original badge */}
            {form.sound && (
              <div onClick={(e) => { e.stopPropagation(); setShowAudioMixer(true); }} className="absolute top-14 left-4 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 active:scale-95 transition-all cursor-pointer">
                <Music className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-white text-[11px] font-black truncate max-w-[120px]">{form.sound.split(" - ")[0]}</span>
                <button onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, sound: null, soundPreviewUrl: null, soundDuration: 0, soundTrimStart: 0, soundTrimEnd: 0 })); if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = ""; } setAddedPlaying(false); }}>
                  <X className="w-3 h-3 text-white/60" />
                </button>
              </div>
            )}
            {form.images.length > 1 && (
              <>
                <button onClick={() => { setActiveImageIdx(i => Math.max(0, i - 1)); setAutoSlide(false); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center z-10">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button onClick={() => { setActiveImageIdx(i => Math.min(form.images.length - 1, i + 1)); setAutoSlide(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center z-10">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
                <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                  <div className="bg-black/50 rounded-full px-3 py-1 flex items-center gap-2">
                    <span className="text-white text-[11px] font-black">{activeImageIdx + 1} / {form.images.length}</span>
                    <button onClick={(e) => { e.stopPropagation(); setAutoSlide(v => !v); }}
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${autoSlide ? "bg-orange-500" : "bg-white/20"}`}>
                      {autoSlide ? <Pause className="w-2.5 h-2.5 text-white" /> : <Play className="w-2.5 h-2.5 text-white ml-0.5" />}
                    </button>
                  </div>
                </div>
                {/* Progress dots */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-10">
                  {form.images.map((_, i) => (
                    <div key={i} className={`rounded-full transition-all duration-300 ${i === activeImageIdx ? "w-4 h-1.5 bg-orange-500" : "w-1.5 h-1.5 bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-transparent">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-white/5">
              <Camera className="w-10 h-10 text-white/15" />
            </div>
            <p className="text-[13px] font-black uppercase tracking-widest text-white/20">
              Ajoutez du contenu
            </p>
          </div>
        )}

        {/* ── Grid overlay (rule of thirds) ── */}
        {showGrid && (form.video_url || form.images.length > 0) && (
          <div className="absolute inset-0 z-15 pointer-events-none" style={{ background: "transparent" }}>
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
            {/* Intersection dots */}
            <div className="absolute top-1/3 left-1/3 w-1.5 h-1.5 -ml-0.75 -mt-0.75 rounded-full bg-white/50" />
            <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 -mr-0.75 -mt-0.75 rounded-full bg-white/50" />
            <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 -ml-0.75 -mb-0.75 rounded-full bg-white/50" />
            <div className="absolute bottom-1/3 right-1/3 w-1.5 h-1.5 -mr-0.75 -mb-0.75 rounded-full bg-white/50" />
          </div>
        )}

        {/* ── Timer countdown overlay ── */}
        {showTimer && timerCount > 0 && (form.video_url || form.images.length > 0) && (
          <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md rounded-3xl px-8 py-5 flex flex-col items-center gap-1">
              <Timer className="w-6 h-6 text-amber-400 mb-1" />
              <span className="text-white text-[48px] font-black leading-none tabular-nums" style={{ fontFamily: "monospace" }}>
                {Math.floor(timerCount / 60)}:{String(timerCount % 60).padStart(2, "0")}
              </span>
              <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">restant</span>
            </div>
          </div>
        )}

        {/* ── Text overlay on preview — draggable ── */}
        {(videoEditorResult?.textOverlay?.text || form.script) && captureMode !== "texte" && (
          <div
            className="absolute z-20 touch-none select-none"
            style={{ left: textPos.x, top: textPos.y, cursor: "grab" }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const s = textDragRef.current;
              s.dragging = true;
              s.startX = e.clientX;
              s.startY = e.clientY;
              s.origX = textPos.x;
              s.origY = textPos.y;
              const container = previewContainerRef.current;
              const cRect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
              const handleMove = (ev) => {
                if (!textDragRef.current.dragging) return;
                ev.preventDefault();
                const newX = textDragRef.current.origX + (ev.clientX - textDragRef.current.startX);
                const newY = textDragRef.current.origY + (ev.clientY - textDragRef.current.startY);
                setTextPos({
                  x: Math.max(0, Math.min(cRect.width - 80, newX)),
                  y: Math.max(0, Math.min(cRect.height - 40, newY)),
                });
              };
              const handleUp = () => {
                textDragRef.current.dragging = false;
                document.removeEventListener("mousemove", handleMove);
                document.removeEventListener("mouseup", handleUp);
              };
              document.addEventListener("mousemove", handleMove, { passive: false });
              document.addEventListener("mouseup", handleUp);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              if (e.touches.length !== 1) return;
              const t = e.touches[0];
              const s = textDragRef.current;
              s.dragging = true;
              s.startX = t.clientX;
              s.startY = t.clientY;
              s.origX = textPos.x;
              s.origY = textPos.y;
              const container = previewContainerRef.current;
              const cRect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
              const handleMove = (ev) => {
                if (!textDragRef.current.dragging) return;
                ev.preventDefault();
                const ct = ev.touches[0];
                const newX = textDragRef.current.origX + (ct.clientX - textDragRef.current.startX);
                const newY = textDragRef.current.origY + (ct.clientY - textDragRef.current.startY);
                setTextPos({
                  x: Math.max(0, Math.min(cRect.width - 80, newX)),
                  y: Math.max(0, Math.min(cRect.height - 40, newY)),
                });
              };
              const handleUp = () => {
                textDragRef.current.dragging = false;
                document.removeEventListener("touchmove", handleMove);
                document.removeEventListener("touchend", handleUp);
              };
              document.addEventListener("touchmove", handleMove, { passive: false });
              document.addEventListener("touchend", handleUp);
            }}
          >
            <div className="bg-black/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10 max-w-[200px]">
              <p className="text-white text-[14px] font-black leading-snug drop-shadow-lg whitespace-pre-wrap">{videoEditorResult?.textOverlay?.text || form.script}</p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none" />
      </div>

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4" style={{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}>
        <button onClick={handleClose}
          className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${isDark ? "bg-white/10 backdrop-blur-md" : "bg-black/10 backdrop-blur-md"}`}>
          <X className={`w-5 h-5 ${isDark ? "text-white" : "text-gray-800"}`} />
        </button>

        {editData && (
          <div className="flex items-center gap-1.5 bg-orange-500/20 rounded-full px-3 py-1">
            <svg className="w-3 h-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Modification</span>
          </div>
        )}

        {/* Ajouter un son — moderne */}
        <button
          onClick={() => { if (form.sound) { setShowAudioMixer(true); } else { setShowSoundPanel(true); } }}
          className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 active:scale-95 transition-all border ${isDark ? "bg-white/10 backdrop-blur-md border-white/15" : "bg-black/5 backdrop-blur-md border-black/10"}`}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Music className="w-3.5 h-3.5 text-white" />
          </div>
          <span className={`text-[13px] font-black truncate max-w-[140px] ${isDark ? "text-white" : "text-gray-800"}`}>
            {form.sound ? form.sound.split(" - ")[0] : "Ajouter un son"}
          </span>
          {form.sound && (
            <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, sound: null, soundPreviewUrl: null })); }}
              className={`w-5 h-5 rounded-full flex items-center justify-center ${isDark ? "bg-white/20" : "bg-black/10"}`}>
              <X className={`w-3 h-3 ${isDark ? "text-white/70" : "text-gray-500"}`} />
            </button>
          )}
        </button>

        <div className="w-10" />
      </div>

      {/* ── Right toolbar — moderne ── */}
      <div className="absolute right-2 z-20 flex flex-col items-center gap-1" style={{ top: "calc(76px + env(safe-area-inset-top, 0px))" }}>
        {/* Badge auto-save */}
        <div className={`flex items-center justify-center mb-1 px-2 py-0.5 rounded-full ${isDark ? "bg-emerald-500/20" : "bg-emerald-500/10"}`}>
          <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">● Auto</span>
        </div>
        {[
          { icon: Hourglass, panel: "minuterie", label: "Timer", gradient: "from-amber-500 to-orange-500", toggle: () => setShowTimer(v => !v), isActive: showTimer },
          { icon: Grid3x3, panel: "disposition", label: "Grille", gradient: "from-blue-500 to-indigo-500", toggle: () => setShowGrid(v => !v), isActive: showGrid },
          { icon: Wand2, panel: "retouche", label: "Retouche", gradient: "from-purple-500 to-pink-500" },
          { icon: Palette, panel: "filtres", label: "Filtres", gradient: "from-teal-500 to-cyan-500" },
          { icon: Crop, panel: "format", label: "Format", gradient: "from-rose-500 to-red-500" },
          { icon: Feather, panel: "texte", label: "Texte", gradient: "from-yellow-500 to-amber-500" },
        ].map(({ icon: Icon, panel, label, gradient, toggle, isActive }) => (
          <button key={panel} onClick={() => {
            if (toggle) { toggle(); return; }
            setActivePanel(activePanel === panel ? null : panel);
          }}
            className="flex flex-col items-center gap-0.5 active:scale-90 transition-all">
            <div className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
              (toggle ? isActive : activePanel === panel)
                ? `bg-gradient-to-br ${gradient} shadow-lg`
                : isDark ? "bg-white/10 backdrop-blur-md border border-white/10" : "bg-black/5 backdrop-blur-md border border-black/5"
            }`}>
              <Icon className={`w-5 h-5 ${(toggle ? isActive : activePanel === panel) ? "text-white" : isDark ? "text-white/80" : "text-gray-600"}`} />
              {(toggle ? isActive : activePanel === panel) && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-full" />
              )}
            </div>
            <span className={`text-[8px] font-bold ${(toggle ? isActive : activePanel === panel) ? "text-white" : isDark ? "text-white/50" : "text-gray-400"}`}>{label}</span>
          </button>
        ))}
        {/* Bouton Créer — ouvre l'éditeur multi-pistes ou vidéo */}
        <button onClick={() => {
            videoRef.current?.pause();
            setIsVideoPaused(true);
            if (form.images.length > 1 && !form.video_url) { setShowTrackEditor(true); }
            else { setShowVideoEditor(true); }
          }}
            className="flex flex-col items-center gap-0.5 active:scale-90 transition-all mt-1">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <span className="text-[8px] font-bold text-orange-400">{form.images.length > 1 && !form.video_url ? "Multi-Pistes" : "Créer"}</span>
          </button>
      </div>

      {/* ── Active panels — thème ── */}
      {activePanel === "minuterie" && (
        <div className={`absolute left-4 right-20 z-30 backdrop-blur-xl rounded-3xl p-5 border ${isDark ? "bg-black/70 border-white/10" : "bg-white/90 border-black/5 shadow-xl"}`} style={{ top: "calc(86px + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center"><Hourglass className="w-3.5 h-3.5 text-white" /></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>Minuterie</p>
          </div>
          <div className="flex gap-2">
            {[15, 30, 60, 90, 600].map(d => (
              <button key={d} onClick={() => { setForm(f => ({ ...f, duration: d })); setActivePanel(null); }}
                className={`flex-1 py-3 rounded-2xl font-black text-[12px] transition-all active:scale-95 ${
                  form.duration === d
                    ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
                }`}>
                {d >= 60 ? (d / 60) + "min" : d + "s"}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === "disposition" && (
        <div className={`absolute left-4 right-20 z-30 backdrop-blur-xl rounded-3xl p-5 border ${isDark ? "bg-black/70 border-white/10" : "bg-white/90 border-black/5 shadow-xl"}`} style={{ top: "calc(86px + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center"><Grid3x3 className="w-3.5 h-3.5 text-white" /></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>Disposition</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1:1", "4:5", "9:16", "16:9", "4:3", "3:4"].map(ratio => (
              <button key={ratio} onClick={() => { setForm(f => ({ ...f, aspectRatio: ratio })); setActivePanel(null); }}
                className={`py-3 rounded-2xl text-[12px] font-black transition-all active:scale-95 ${
                  form.aspectRatio === ratio
                    ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                    : isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
                }`}>
                {ratio}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === "retouche" && (
        <div className={`absolute left-4 right-20 z-30 backdrop-blur-xl rounded-3xl p-5 space-y-4 border ${isDark ? "bg-black/70 border-white/10" : "bg-white/90 border-black/5 shadow-xl"}`} style={{ top: "calc(86px + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><Wand2 className="w-3.5 h-3.5 text-white" /></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>Retouche</p>
          </div>
          {[
            { label: "Luminosité", icon: Sun, key: "brightness", min: 50, max: 200, gradient: "from-yellow-400 to-amber-500" },
            { label: "Contraste", icon: Contrast, key: "contrast", min: 50, max: 200, gradient: "from-blue-400 to-indigo-500" },
            { label: "Saturation", icon: Droplets, key: "saturation", min: 0, max: 300, gradient: "from-pink-400 to-rose-500" },
          ].map(({ label, icon: Icon, key, min, max, gradient }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}><Icon className="w-3 h-3 text-white" /></div>
                  <span className={`text-[11px] font-bold ${isDark ? "text-white/70" : "text-gray-600"}`}>{label}</span>
                </div>
                <span className="text-[10px] font-black text-primary">{form[key]}%</span>
              </div>
              <input type="range" min={min} max={max} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                className="w-full accent-primary h-1.5 rounded-full" />
            </div>
          ))}
          <button onClick={() => setActivePanel(null)} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-[11px] uppercase py-3 rounded-2xl active:scale-95 shadow-lg shadow-purple-500/20">OK</button>
        </div>
      )}

      {activePanel === "filtres" && (
        <div className={`absolute left-4 right-20 z-30 backdrop-blur-xl rounded-3xl p-5 border ${isDark ? "bg-black/70 border-white/10" : "bg-white/90 border-black/5 shadow-xl"}`} style={{ top: "calc(86px + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center"><Palette className="w-3.5 h-3.5 text-white" /></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>Filtres</p>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {FILTERS.map(f => (
              <button key={String(f.id)} onClick={() => { setForm(fm => ({ ...fm, filter: f.id })); setActivePanel(null); }}
                className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95">
                <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all ${
                  form.filter === f.id ? "border-teal-400 shadow-lg shadow-teal-500/20 scale-105" : isDark ? "border-white/10" : "border-gray-200"
                }`}>
                  {form.images[activeImageIdx] || form.images[0]
                    ? <BeautyImage src={form.images[activeImageIdx] || form.images[0]} alt="" className="w-full h-full object-cover" style={f.style} />
                    : <div className={`w-full h-full flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-100"}`}><Camera className={`w-6 h-6 ${isDark ? "text-gray-500" : "text-gray-300"}`} /></div>
                  }
                </div>
                <span className={`text-[10px] font-black uppercase ${form.filter === f.id ? "text-teal-400" : isDark ? "text-white/50" : "text-gray-400"}`}>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === "format" && (
        <div className={`absolute left-4 right-14 z-30 backdrop-blur-xl rounded-3xl p-5 border ${isDark ? "bg-black/70 border-white/10" : "bg-white/90 border-black/5 shadow-xl"}`} style={{ top: "calc(86px + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center"><Crop className="w-3.5 h-3.5 text-white" /></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>Format</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "9:16", icon: "📱", fit: "cover" },
              { label: "4:5", icon: "🖼", fit: "cover" },
              { label: "1:1", icon: "⬜", fit: "cover" },
              { label: "4:3", icon: "🌄", fit: "contain" },
              { label: "16:9", icon: "🖥", fit: "contain" },
              { label: "Orig.", icon: "✦", fit: "contain" },
            ].map(f => (
              <button key={f.label} onClick={() => { setForm(fm => ({ ...fm, aspectRatio: f.label, objectFit: f.fit })); setActivePanel(null); }}
                className={`flex flex-col items-center py-3 gap-1.5 rounded-2xl transition-all active:scale-95 ${
                  form.aspectRatio === f.label
                    ? "bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-red-500/20"
                    : isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500"
                }`}>
                <span className="text-[18px]">{f.icon}</span>
                <span className="text-[10px] font-black">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === "texte" && (
        <div className={`absolute left-4 right-20 z-30 backdrop-blur-xl rounded-3xl p-5 border ${isDark ? "bg-black/70 border-white/10" : "bg-white/90 border-black/5 shadow-xl"}`} style={{ top: "calc(86px + env(safe-area-inset-top, 0px))" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center"><Feather className="w-3.5 h-3.5 text-white" /></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>Texte</p>
          </div>
          <textarea value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
            placeholder="Écrivez votre texte..." rows={2}
            className={`w-full text-[13px] rounded-2xl px-4 py-3 outline-none resize-none mb-3 ${isDark ? "bg-white/10 text-white placeholder:text-white/30" : "bg-gray-100 text-gray-800 placeholder:text-gray-400"}`} />
          <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-white/40" : "text-gray-400"}`}>Fond d'écran</p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3">
            {TEXT_BACKGROUNDS.map(b => (
              <button key={b.id} onClick={() => setTextBg(b.id)}
                className={`shrink-0 w-10 h-10 rounded-xl ${b.bg} border-2 transition-all active:scale-95 ${textBg === b.id ? "border-white scale-110 shadow-lg" : "border-transparent"}`} />
            ))}
          </div>
          <button onClick={() => setActivePanel(null)} className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-black text-[12px] uppercase py-3 rounded-2xl active:scale-95 shadow-lg shadow-amber-500/20">Valider</button>
        </div>
      )}

      {/* ═══ MULTI-TRACK EDITOR ═══ */}
      {showTrackEditor && (
        <div className="fixed inset-0 z-[80] flex flex-col font-display" style={{ backgroundColor: "#0a0a14" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-6 pb-3" style={{ paddingTop: "calc(24px + env(safe-area-inset-top, 0px))" }}>
            <button onClick={() => setShowTrackEditor(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-[16px] font-black text-white uppercase tracking-wider">Éditeur Multi-Pistes</h2>
            <button onClick={() => { setShowTrackEditor(false); setShowVideoEditor(true); }} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500">
              <span className="text-[11px] font-black text-white">Suivant</span>
            </button>
          </div>

          {/* Preview zone */}
          <div className="relative mx-4 rounded-2xl overflow-hidden bg-black/50" style={{ height: "40vh" }}>
            {allMedia.length > 0 ? (
              <>
                {allMedia[activeTrackIdx]?.type === "video" ? (
                  <video src={allMedia[activeTrackIdx].url} className="w-full h-full object-contain" autoPlay loop playsInline muted={false} />
                ) : (
                  <BeautyImage src={allMedia[activeTrackIdx]?.url} alt="" className="w-full h-full object-contain" />
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-white text-[11px] font-black">{activeTrackIdx + 1} / {allMedia.length}</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-white/30 text-[13px] font-black">Aucun média importé</p>
              </div>
            )}
          </div>

          {/* Track timeline */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 hide-scrollbar">
            {/* Piste principale */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Film className="w-3 h-3 text-white" />
                </div>
                <span className="text-[11px] font-black text-white/60 uppercase tracking-wider">Piste Principale</span>
                <span className="text-[9px] font-bold text-white/30">{allMedia.length} clips</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {allMedia.map((media, i) => (
                  <button key={media.id || i}
                    onClick={() => setActiveTrackIdx(i)}
                    className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                      activeTrackIdx === i ? "border-orange-500 shadow-lg shadow-orange-500/20" : "border-white/10"
                    }`} style={{ width: 80, height: 100 }}>
                    {media.type === "video" ? (
                      <video src={media.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <BeautyImage src={media.url} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5">
                      <span className="text-white text-[8px] font-black">{media.type === "video" ? "🎬" : "🖼"}</span>
                    </div>
                    {activeTrackIdx === i && (
                      <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <button onClick={(e) => {
                      e.stopPropagation();
                      setAllMedia(prev => prev.filter((_, idx) => idx !== i));
                      if (activeTrackIdx >= allMedia.length - 1) setActiveTrackIdx(Math.max(0, allMedia.length - 2));
                    }} className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </button>
                ))}
                {/* Ajouter un média */}
                <button onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 w-20 h-24 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                  <Plus className="w-5 h-5 text-white/40" />
                  <span className="text-[8px] font-bold text-white/30">Ajouter</span>
                </button>
              </div>
            </div>

            {/* Pistes audio */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Music className="w-3 h-3 text-white" />
                </div>
                <span className="text-[11px] font-black text-white/60 uppercase tracking-wider">Pistes Audio</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                {form.sound ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white truncate">{form.sound.split(" - ")[0]}</p>
                      <p className="text-[9px] text-white/40">{form.sound.split(" - ")[1] || ""}</p>
                    </div>
                    <button onClick={() => setShowAudioMixer(true)} className="px-3 py-1.5 rounded-full bg-white/10">
                      <span className="text-[10px] font-black text-white/60">Mixeur</span>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setShowTrackEditor(false); setShowSoundPanel(true); }}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl active:scale-95">
                    <Plus className="w-4 h-4 text-white/40" />
                    <span className="text-[11px] font-bold text-white/40">Ajouter un son</span>
                  </button>
                )}
              </div>
            </div>

            {/* Ordre des clips */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <GripVertical className="w-3 h-3 text-white" />
                </div>
                <span className="text-[11px] font-black text-white/60 uppercase tracking-wider">Glissez pour réorganiser</span>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Appuyez longuement sur un clip pour le déplacer. L'ordre détermine la séquence de lecture finale.
              </p>
            </div>
          </div>

          {/* Bottom action */}
          <div className="px-4 pb-6" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
            <button onClick={() => { setShowTrackEditor(false); if (form.video_url) { videoRef.current?.pause(); setIsVideoPaused(true); setShowVideoEditor(true); } }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[14px] uppercase tracking-wider active:scale-[0.98] shadow-lg shadow-orange-500/30">
              Continuer l'édition →
            </button>
          </div>
        </div>
      )}

      {/* ═══ AUDIO MIXER PANEL ═══ */}
      {showAudioMixer && (
        <div className="fixed inset-0 z-[75] flex flex-col font-display" style={{ backgroundColor: "#0a0a14" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-6 pb-3" style={{ paddingTop: "calc(24px + env(safe-area-inset-top, 0px))" }}>
            <button onClick={() => setShowAudioMixer(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-[16px] font-black text-white uppercase tracking-wider">Mixeur Audio</h2>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4 hide-scrollbar">
            {/* ── Piste 1 : Son original de la vidéo ── */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-white">Son original</p>
                  <p className="text-[10px] text-white/40">Audio de la vidéo importée</p>
                </div>
                {/* Play/Pause original */}
                <button onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  if (!originalMuted) {
                    setOriginalMuted(true);
                  } else {
                    setOriginalMuted(false);
                    v.volume = originalVolume / 100;
                  }
                }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all">
                  {originalMuted ? <VolumeX className="w-5 h-5 text-white/50" /> : <Volume2 className="w-5 h-5 text-blue-400" />}
                </button>
              </div>
              {/* Volume slider */}
              <div className="flex items-center gap-3">
                <VolumeX className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <div className="flex-1 relative h-8 flex items-center group">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all" style={{ width: `${originalMuted ? 0 : originalVolume}%` }} />
                  </div>
                  <input
                    type="range" min="0" max="100" value={originalMuted ? 0 : originalVolume}
                    onChange={(e) => { const v = parseInt(e.target.value); setOriginalVolume(v); setOriginalMuted(false); if (videoRef.current) videoRef.current.volume = v / 100; }}
                    className="absolute inset-x-0 w-full h-8 opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-all" style={{ left: `calc(${originalMuted ? 0 : originalVolume}% - 8px)` }} />
                </div>
                <Volume2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-[10px] font-bold text-white/40 w-8 text-right">{originalMuted ? "0" : originalVolume}%</span>
              </div>
              {/* Waveform */}
              <div className="flex items-center gap-px mt-3 h-6">
                {Array.from({ length: 50 }).map((_, i) => {
                  const seed = ((i * 13 + 7) % 11) / 11;
                  return <div key={i} className="flex-1 rounded-full transition-all" style={{ height: `${10 + seed * 90}%`, backgroundColor: originalMuted ? "rgba(255,255,255,0.05)" : `rgba(99,102,241,${0.2 + seed * 0.5})` }} />;
                })}
              </div>
            </div>

            {/* ── Piste 2 : Son ajouté ── */}
            {form.sound ? (
              <div className="bg-white/5 rounded-2xl p-4 border border-orange-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-white truncate">{form.sound.split(" - ")[0]}</p>
                    <p className="text-[10px] text-white/40 truncate">{form.sound.split(" - ")[1] || ""}</p>
                  </div>
                  {/* Play/Pause ajouté */}
                  <button onClick={() => {
                    const audio = previewAudioRef.current;
                    if (!audio || !form.soundPreviewUrl) return;
                    if (addedPlaying) {
                      audio.pause();
                      setAddedPlaying(false);
                    } else {
                      audio.currentTime = form.soundTrimStart || 0;
                      audio.volume = addedMuted ? 0 : addedVolume / 100;
                      audio.play().catch(() => {});
                      setAddedPlaying(true);
                    }
                  }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all">
                    {addedPlaying ? <Pause className="w-5 h-5 text-orange-400" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                  </button>
                  {/* Mute ajouté */}
                  <button onClick={() => setAddedMuted(m => !m)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-all">
                    {addedMuted ? <VolumeX className="w-5 h-5 text-white/50" /> : <Volume2 className="w-5 h-5 text-orange-400" />}
                  </button>
                  {/* Supprimer */}
                  <button onClick={() => { setForm(f => ({ ...f, sound: null, soundPreviewUrl: null, soundDuration: 0, soundTrimStart: 0, soundTrimEnd: 0 })); if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = ""; } setAddedPlaying(false); }} className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center active:scale-90 transition-all">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
                {/* Volume slider */}
                <div className="flex items-center gap-3">
                  <VolumeX className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <div className="flex-1 relative h-8 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all" style={{ width: `${addedMuted ? 0 : addedVolume}%` }} />
                    </div>
                    <input
                      type="range" min="0" max="100" value={addedMuted ? 0 : addedVolume}
                      onChange={(e) => { const v = parseInt(e.target.value); setAddedVolume(v); setAddedMuted(false); }}
                      className="absolute inset-x-0 w-full h-8 opacity-0 cursor-pointer z-10"
                    />
                    <div className="absolute w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-all" style={{ left: `calc(${addedMuted ? 0 : addedVolume}% - 8px)` }} />
                  </div>
                  <Volume2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-[10px] font-bold text-white/40 w-8 text-right">{addedMuted ? "0" : addedVolume}%</span>
                </div>

                {/* Trim section */}
                {form.soundDuration > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-wider">Sélection</span>
                      <span className="text-[9px] font-bold text-orange-400/60">
                        {Math.floor((form.soundTrimStart || 0) / 60)}:{String(Math.floor((form.soundTrimStart || 0) % 60)).padStart(2, "0")} — {Math.floor((form.soundTrimEnd || form.soundDuration) / 60)}:{String(Math.floor((form.soundTrimEnd || form.soundDuration) % 60)).padStart(2, "0")} ({Math.floor(((form.soundTrimEnd || form.soundDuration) - (form.soundTrimStart || 0)) / 60)}:{String(Math.floor(((form.soundTrimEnd || form.soundDuration) - (form.soundTrimStart || 0)) % 60)).padStart(2, "0")})
                      </span>
                    </div>
                    <div className="relative h-10 rounded-xl overflow-hidden bg-white/5 select-none" ref={trimBarRef}>
                      {/* Waveform */}
                      <div className="absolute inset-0 flex items-center px-1 gap-px">
                        {Array.from({ length: 60 }).map((_, i) => {
                          const seed = ((i * 7 + 3) % 11) / 11;
                          return <div key={i} className="flex-1 rounded-full bg-orange-400/20" style={{ height: `${15 + seed * 70}%` }} />;
                        })}
                      </div>
                      {/* Zone sélectionnée */}
                      <div
                        className="absolute top-0 bottom-0 bg-orange-500/30 border-y-2 border-orange-400"
                        style={{
                          left: `${((form.soundTrimStart || 0) / form.soundDuration) * 100}%`,
                          right: `${100 - ((form.soundTrimEnd || form.soundDuration) / form.soundDuration) * 100}%`,
                        }}
                      />
                      {/* Handle début */}
                      <div
                        className="absolute top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                        style={{ left: `calc(${((form.soundTrimStart || 0) / form.soundDuration) * 100}% - 12px)` }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          const bar = trimBarRef.current;
                          if (!bar) return;
                          const startX = e.touches[0].clientX;
                          const origStart = form.soundTrimStart || 0;
                          const handleMove = (ev) => {
                            ev.preventDefault();
                            const dx = ev.touches[0].clientX - startX;
                            const barWidth = bar.getBoundingClientRect().width;
                            const timeDelta = (dx / barWidth) * form.soundDuration;
                            const newStart = Math.max(0, Math.min((form.soundTrimEnd || form.soundDuration) - 1, origStart + timeDelta));
                            setForm(f => ({ ...f, soundTrimStart: newStart }));
                          };
                          const handleUp = () => {
                            document.removeEventListener("touchmove", handleMove);
                            document.removeEventListener("touchend", handleUp);
                          };
                          document.addEventListener("touchmove", handleMove, { passive: false });
                          document.addEventListener("touchend", handleUp);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const bar = trimBarRef.current;
                          if (!bar) return;
                          const startX = e.clientX;
                          const origStart = form.soundTrimStart || 0;
                          const handleMove = (ev) => {
                            const dx = ev.clientX - startX;
                            const barWidth = bar.getBoundingClientRect().width;
                            const timeDelta = (dx / barWidth) * form.soundDuration;
                            const newStart = Math.max(0, Math.min((form.soundTrimEnd || form.soundDuration) - 1, origStart + timeDelta));
                            setForm(f => ({ ...f, soundTrimStart: newStart }));
                          };
                          const handleUp = () => {
                            document.removeEventListener("mousemove", handleMove);
                            document.removeEventListener("mouseup", handleUp);
                          };
                          document.addEventListener("mousemove", handleMove);
                          document.addEventListener("mouseup", handleUp);
                        }}
                      >
                        <div className="w-1 h-7 bg-orange-400 rounded-full shadow-lg" />
                      </div>
                      {/* Handle fin */}
                      <div
                        className="absolute top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                        style={{ left: `calc(${((form.soundTrimEnd || form.soundDuration) / form.soundDuration) * 100}% - 12px)` }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          const bar = trimBarRef.current;
                          if (!bar) return;
                          const startX = e.touches[0].clientX;
                          const origEnd = form.soundTrimEnd || form.soundDuration;
                          const handleMove = (ev) => {
                            ev.preventDefault();
                            const dx = ev.touches[0].clientX - startX;
                            const barWidth = bar.getBoundingClientRect().width;
                            const timeDelta = (dx / barWidth) * form.soundDuration;
                            const newEnd = Math.max((form.soundTrimStart || 0) + 1, Math.min(form.soundDuration, origEnd + timeDelta));
                            setForm(f => ({ ...f, soundTrimEnd: newEnd }));
                          };
                          const handleUp = () => {
                            document.removeEventListener("touchmove", handleMove);
                            document.removeEventListener("touchend", handleUp);
                          };
                          document.addEventListener("touchmove", handleMove, { passive: false });
                          document.addEventListener("touchend", handleUp);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const bar = trimBarRef.current;
                          if (!bar) return;
                          const startX = e.clientX;
                          const origEnd = form.soundTrimEnd || form.soundDuration;
                          const handleMove = (ev) => {
                            const dx = ev.clientX - startX;
                            const barWidth = bar.getBoundingClientRect().width;
                            const timeDelta = (dx / barWidth) * form.soundDuration;
                            const newEnd = Math.max((form.soundTrimStart || 0) + 1, Math.min(form.soundDuration, origEnd + timeDelta));
                            setForm(f => ({ ...f, soundTrimEnd: newEnd }));
                          };
                          const handleUp = () => {
                            document.removeEventListener("mousemove", handleMove);
                            document.removeEventListener("mouseup", handleUp);
                          };
                          document.addEventListener("mousemove", handleMove);
                          document.addEventListener("mouseup", handleUp);
                        }}
                      >
                        <div className="w-1 h-7 bg-orange-400 rounded-full shadow-lg" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] font-bold text-white/30">0:00</span>
                      <span className="text-[8px] font-bold text-orange-400/60">
                        Durée: {Math.floor(((form.soundTrimEnd || form.soundDuration) - (form.soundTrimStart || 0)) / 60)}:{String(Math.floor(((form.soundTrimEnd || form.soundDuration) - (form.soundTrimStart || 0)) % 60)).padStart(2, "0")}
                      </span>
                      <span className="text-[8px] font-bold text-white/30">{Math.floor(form.soundDuration / 60)}:{String(Math.floor(form.soundDuration % 60)).padStart(2, "0")}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => { setShowAudioMixer(false); setShowSoundPanel(true); }}
                className="w-full bg-white/5 border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center gap-2 active:scale-[0.98] transition-all">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-orange-400" />
                </div>
                <span className="text-[13px] font-black text-white/60">Ajouter un son</span>
                <span className="text-[10px] text-white/30">Rechercher dans la bibliothèque</span>
              </button>
            )}

            {/* ── Info ── */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-black text-white/60 uppercase tracking-wider">Mixage</span>
              </div>
              <p className="text-[11px] text-white/30 leading-relaxed">
                Ajustez le volume de chaque piste indépendamment. Utilisez les curseurs pour define l'équilibre parfait entre le son original et la musique ajoutée. Sélectionnez la partie souhaitée avec les poignées orange.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode selector — moderne ── */}
      <div className="absolute left-0 right-0 z-20" style={{ bottom: "calc(116px + env(safe-area-inset-bottom, 0px))", backgroundColor: "transparent" }}>
        <div className="flex items-center justify-center gap-1 px-4 py-2 rounded-full mx-6" style={{ backgroundColor: "transparent" }}>
          {CAPTURE_MODES.map(m => (
            <button key={m.id} onClick={() => handleSetCaptureMode(m.id)}
              className={`relative text-[12px] font-black px-4 py-2 rounded-full transition-all active:scale-95 ${
                captureMode === m.id
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20"
                  : "text-white/50"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom: importer + capture + suivant ── */}
      <div className="absolute left-0 right-0 z-20 flex items-center justify-between px-8" style={{ bottom: "calc(28px + env(safe-area-inset-bottom, 0px))", backgroundColor: "transparent" }}>

        {/* Importer : photos multiples OU vidéo */}
        <button
          onClick={() => {
            if (captureMode === "video") videoInputRef.current?.click();
            else fileInputRef.current?.click();
          }}
          className="w-14 h-14 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border border-white/20"
        >
          {form.images.length > 0 ? (
            <div className="relative w-full h-full">
              <BeautyImage src={form.images[0]} alt="" className="w-full h-full object-cover" />
              {form.images.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex items-center justify-center py-0.5">
                  <span className="text-white text-[8px] font-black">{form.images.length}📷</span>
                </div>
              )}
            </div>
          ) : videoThumb ? (
            <div className="relative w-full h-full">
              <BeautyImage src={videoThumb} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <>
              <Upload className={`w-5 h-5 ${isDark ? "text-white/60" : "text-gray-400"}`} />
              <span className={`text-[8px] font-black ${isDark ? "text-white/50" : "text-gray-400"}`}>Importer</span>
            </>
          )}
        </button>

        {/* Bouton capture principal — redesigné */}
        <button
          onClick={() => {
            if (captureMode === "texte") { setActivePanel("texte"); return; }
            if (captureMode === "creer") {
              if (form.video_url) setShowVideoEditor(true);
              else videoInputRef.current?.click();
              return;
            }
            if (captureMode === "photo") { photoInputRef.current?.click(); return; }
            startCameraRecording("video");
          }}
          disabled={uploading}
          className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center active:scale-95 transition-all"
        >
          {/* Outer ring */}
          <div className={`absolute inset-0 rounded-full border-[3px] ${isDark ? "border-white/80" : "border-gray-800"}`} />
          {/* Inner fill */}
          <div className={`w-[58px] h-[58px] rounded-full flex items-center justify-center transition-all ${
            captureMode === "video" && !uploading
              ? "bg-white"
              : captureMode === "photo"
                ? "bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30"
                : isDark ? "bg-white/20" : "bg-gray-200"
          }`}>
            {uploading
              ? <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
              : captureMode === "texte"
                ? <Type className="w-6 h-6 text-white" />
                : captureMode === "creer"
                  ? <Clapperboard className="w-6 h-6 text-white" />
                  : captureMode === "photo"
                    ? <Camera className="w-6 h-6 text-white" />
                    : <div className="w-10 h-10 rounded-full bg-white" />
            }
          </div>
        </button>

        {/* Suivant → */}
        <button
          onClick={() => { setActivePanel(null); next(); }}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center active:scale-95 shadow-lg shadow-orange-500/30"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Barre de gestion des images — thème */}
      {form.images.length > 0 && (
        <div
          className="absolute left-0 right-0 z-20"
          style={{ bottom: "calc(176px + env(safe-area-inset-bottom, 0px))", backgroundColor: "transparent" }}
        >
          <div className="px-3">
            {/* Label */}
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <Images className={`w-3 h-3 ${isDark ? "text-white/60" : "text-gray-400"}`} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-white/60" : "text-gray-400"}`}>
                {form.images.length} photo{form.images.length > 1 ? "s" : ""} — glisser pour réordonner
              </span>
            </div>
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const newImages = Array.from(form.images);
              const [moved] = newImages.splice(result.source.index, 1);
              newImages.splice(result.destination.index, 0, moved);
              setForm(f => ({ ...f, images: newImages }));
            }}>
              <Droppable droppableId="images-strip" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex gap-2 overflow-x-auto hide-scrollbar pb-1"
                  >
                    {form.images.map((img, i) => (
                      <Draggable key={img + i} draggableId={`img-${i}`} index={i}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                              snapshot.isDragging ? "border-orange-400 scale-105 shadow-lg shadow-orange-500/30" : isDark ? "border-white/20" : "border-gray-200"
                            }`}
                            style={{ width: 64, height: 80, ...drag.draggableProps.style }}
                            onClick={() => {
                              // Clic sur la miniature → afficher cette image en preview
                              const newImages = [...form.images];
                              newImages.splice(i, 1);
                              newImages.unshift(img);
                              setForm(f => ({ ...f, images: newImages }));
                            }}
                          >
                            <BeautyImage src={img} alt="" className="w-full h-full object-cover" />
                            {/* Badge numéro */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 flex items-center justify-center py-0.5">
                              <span className="text-white text-[8px] font-black">{i + 1}</span>
                            </div>
                            {/* Bouton supprimer */}
                            <button
                              onClick={e => { e.stopPropagation(); removeImage(i); }}
                              className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center active:scale-90"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {/* Bouton ajouter d'autres photos */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:scale-95 ${
                        isDark ? "border-white/20 bg-white/5" : "border-gray-300 bg-gray-50"
                      }`}
                      style={{ width: 64, height: 80 }}
                    >
                      <Plus className={`w-4 h-4 ${isDark ? "text-white/50" : "text-gray-400"}`} />
                      <span className={`text-[7px] font-black ${isDark ? "text-white/40" : "text-gray-400"}`}>Ajouter</span>
                    </button>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      )}
    </div>
  );

  // ── STEP 4: Prévisualisation plein écran style Reel ────────────────────────
  if (step === 4) {
    const hasMedia = form.video_url || form.images.length > 0;
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col font-display" style={{ height: "100dvh" }}>
        {/* Audio preview pour la musique en prévisualisation */}
        {form.soundPreviewUrl && (
          <audio src={form.soundPreviewUrl} autoPlay loop style={{ display: "none" }} />
        )}
        {/* Fond media */}
        <div className="absolute inset-0">
          {form.video_url ? (
            <video src={form.video_url} autoPlay loop playsInline muted={false}
              className="w-full h-full" style={{ objectFit: form.objectFit || "cover", ...getImageStyle() }} />
          ) : form.images.length > 0 ? (
            <>
              <BeautyImage src={form.images[previewIdx]} alt="" className="w-full h-full object-cover" style={getImageStyle()} />
              {form.images.length > 1 && (
                <>
                  <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center z-10">
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setPreviewIdx(i => Math.min(form.images.length - 1, i + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center z-10">
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                  {/* Dots */}
                  <div className="absolute top-20 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {form.images.map((_, i) => (
                      <div key={i} className={`rounded-full transition-all ${i === previewIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-[#1a1a2e]" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40 pointer-events-none" />
        </div>

        {/* Badge "Aperçu" en haut */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
          style={{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}>
          <button onClick={back} className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-white text-[12px] font-black uppercase tracking-widest">👁 Prévisualisation</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Overlay info bas — style reel */}
        <div className="absolute left-4 right-20 z-20 space-y-2" style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 16px))" }}>
          {form.caption && (
            <p className="text-white text-[15px] font-black leading-tight">{form.caption}</p>
          )}
          {form.sound && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <Music className="w-3 h-3 text-white" />
              </div>
              <p className="text-white/80 text-[12px] font-medium truncate">{form.sound.split(" - ")[0]}</p>
            </div>
          )}
          {(form.product_name || form.service_name) && (
            <div className="inline-flex items-center gap-2 bg-primary rounded-full px-4 py-2 shadow-lg shadow-primary/30">
              <ShoppingBag className="w-4 h-4 text-white" strokeWidth={2} />
              <span className="text-white text-[13px] font-black">{form.product_name || form.service_name}</span>
            </div>
          )}
        </div>

        {/* Boutons actions droite — style reel simulé */}
        <div className="absolute right-3 z-20 flex flex-col items-center gap-4" style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 16px))" }}>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-black">0</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-black">0</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-black">Partager</span>
          </div>
        </div>

        {/* Barre du bas */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white/10 backdrop-blur-md px-5 py-4 flex items-center gap-3"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={draft} className="px-4 py-3 bg-white/20 rounded-2xl text-[11px] font-black text-white uppercase tracking-widest active:scale-95">Brouillon</button>
          <button onClick={next} className="flex-1 bg-primary text-white font-black text-[14px] uppercase tracking-widest py-3 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-all">
            Continuer →
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2: Détails ─────────────────────────────────────────────────────────
  if (step === 2) return (
    <div className="fixed inset-0 z-50 flex flex-col font-display" style={{ background: stepIsDark ? "#0a0a14" : "#fff" }}>
      <StepBar step={2} total={5} label="DÉTAILS" isDark={stepIsDark} />
      <div className="absolute top-5 left-5">
        <button onClick={onClose} className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${stepIsDark ? "bg-white/10" : "bg-gray-100"}`}>
          <X className={`w-5 h-5 ${stepIsDark ? "text-white" : "text-gray-700"}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 hide-scrollbar space-y-5">
        <div>
          <h2 className={`text-[26px] font-black mb-1 ${stepIsDark ? "text-white" : "text-gray-900"}`}>Détails de la publication</h2>
          <p className={`text-[13px] font-medium ${stepIsDark ? "text-white/50" : "text-gray-500"}`}>Ajoutez le contexte de votre création.</p>
        </div>

        {/* Caption */}
        <div className={`rounded-2xl p-3 flex gap-3 ${!form.caption.trim() ? "border border-orange-500/30" : ""}`} style={{ background: stepIsDark ? "rgba(255,255,255,0.05)" : "#f9fafb" }}>
          {form.images[0] && (
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
              <BeautyImage src={form.images[0]} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <span className={!form.caption.trim() ? "text-primary" : stepIsDark ? "text-white/40" : "text-gray-400"}>Légende</span>
              <span className="text-primary font-black">*</span>
            </p>
            <textarea value={form.caption}
              onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              placeholder="Décrivez votre création..."
              rows={3}
              className={`w-full bg-transparent text-[13px] outline-none resize-none font-medium ${stepIsDark ? "text-white placeholder:text-white/30" : "text-gray-700 placeholder:text-gray-400"}`} />
          </div>
        </div>

        {/* Type de publication */}
        <div>
          <p className={`text-[12px] font-black uppercase tracking-widest mb-3 ${stepIsDark ? "text-white" : "text-gray-900"}`}>Type de publication</p>
          <div className="flex gap-3">
            {PUB_TYPES.map(({ id, label, icon: Icon, color }) => (
              <button key={id} onClick={() => setForm(f => ({ ...f, pubType: id }))}
                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${form.pubType === id ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
                <Icon className={`w-6 h-6 ${form.pubType === id ? "text-primary" : stepIsDark ? "text-white/40" : "text-gray-400"}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${form.pubType === id ? "text-primary" : stepIsDark ? "text-white/50" : "text-gray-500"}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <p className="text-[12px] font-black uppercase tracking-widest mb-3 flex items-center gap-1">
            <span className={form.hashtags.length === 0 ? "text-primary" : stepIsDark ? "text-white" : "text-gray-900"}>Hashtags</span>
            <span className="text-primary font-black">*</span>
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {HASHTAGS.map(tag => (
              <button key={tag} onClick={() => toggleHashtag(tag)}
                className={`px-4 py-2 rounded-full border text-[12px] font-bold transition-all active:scale-[0.97] ${form.hashtags.includes(tag) ? "bg-primary text-white border-primary" : stepIsDark ? "bg-white/5 text-white/60 border-white/10" : "bg-gray-100 text-gray-600 border-transparent"}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Visibilité */}
        <div>
          <p className={`text-[12px] font-black uppercase tracking-widest mb-3 ${stepIsDark ? "text-white" : "text-gray-900"}`}>Visibilité</p>
          <div className="flex gap-3">
            <button onClick={() => setForm(f => ({ ...f, visibility: "public" }))}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${form.visibility === "public" ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
              <Globe className={`w-6 h-6 ${form.visibility === "public" ? "text-primary" : stepIsDark ? "text-white/40" : "text-gray-400"}`} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${form.visibility === "public" ? "text-primary" : stepIsDark ? "text-white/50" : "text-gray-500"}`}>Public</span>
            </button>
            <button onClick={() => setForm(f => ({ ...f, visibility: "masque" }))}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${form.visibility === "masque" ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
              <Lock className={`w-6 h-6 ${form.visibility === "masque" ? "text-primary" : stepIsDark ? "text-white/40" : "text-gray-400"}`} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${form.visibility === "masque" ? "text-primary" : stepIsDark ? "text-white/50" : "text-gray-500"}`}>Masqué</span>
            </button>
          </div>
        </div>
      </div>
      {bottomBar()}
    </div>
  );

  // ── STEP 3: Lier un produit ou service ──────────────────────────────────────
  if (step === 3) return (
    <div className="fixed inset-0 z-50 flex flex-col font-display" style={{ background: stepIsDark ? "#0a0a14" : "#fff" }}>
      <StepBar step={3} total={5} label="LIEN" isDark={stepIsDark} />
      <div className="absolute top-5 left-5">
        <button onClick={onClose} className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${stepIsDark ? "bg-white/10" : "bg-gray-100"}`}>
          <X className={`w-5 h-5 ${stepIsDark ? "text-white" : "text-gray-700"}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 hide-scrollbar space-y-5">
        <div>
          <h2 className={`text-[26px] font-black mb-1 ${stepIsDark ? "text-white" : "text-gray-900"}`}>Lier un produit ou service</h2>
          <p className={`text-[13px] font-medium ${stepIsDark ? "text-white/50" : "text-gray-500"}`}>Associez votre contenu à un produit ou un service (optionnel).</p>
        </div>

        {/* Choix : Produit et/ou Service */}
        <div className="flex gap-3">
          <button onClick={() => setShowProductList(v => !v)}
            className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${showProductList ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
            <ShoppingBag className={`w-6 h-6 ${showProductList ? "text-primary" : stepIsDark ? "text-white/40" : "text-gray-400"}`} />
            <span className={`text-[11px] font-black uppercase tracking-widest ${showProductList ? "text-primary" : stepIsDark ? "text-white/50" : "text-gray-500"}`}>Produit</span>
          </button>
          <button onClick={() => setShowServiceList(v => !v)}
            className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${showServiceList ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
            <Star className={`w-6 h-6 ${showServiceList ? "text-primary" : stepIsDark ? "text-white/40" : "text-gray-400"}`} />
            <span className={`text-[11px] font-black uppercase tracking-widest ${showServiceList ? "text-primary" : stepIsDark ? "text-white/50" : "text-gray-500"}`}>Service</span>
          </button>
        </div>

        {/* Liste produits */}
        {showProductList && (
          <div className="space-y-2">
            <p className={`text-[11px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Sélectionnez un produit</p>
            {produits.length === 0 ? (
              <p className={`text-[13px] font-medium py-4 text-center ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Aucun produit disponible</p>
            ) : (
              produits.map(p => (
                <button key={p.id} onClick={() => setForm(f => ({
                  ...f,
                  product_id: f.product_id === p.id ? null : p.id,
                  product_name: f.product_id === p.id ? null : p.name,
                  product_img: f.product_id === p.id ? null : p.image_url,
                }))}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${form.product_id === p.id ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-100 bg-gray-50"}`}>
                  <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 ${stepIsDark ? "bg-white/10" : "bg-gray-200"}`}>
                    {p.image_url && <BeautyImage src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[13px] font-black ${stepIsDark ? "text-white" : "text-gray-900"}`}>{p.name}</p>
                    <p className="text-[11px] font-bold text-primary">{p.price}€</p>
                  </div>
                  {form.product_id === p.id && <Check className="w-5 h-5 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        )}

        {/* Liste services */}
        {showServiceList && (
          <div className="space-y-2">
            <p className={`text-[11px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Sélectionnez un service</p>
            {services.length === 0 ? (
              <p className={`text-[13px] font-medium py-4 text-center ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Aucun service disponible</p>
            ) : (
              services.map(s => (
                <button key={s.id} onClick={() => setForm(f => ({
                  ...f,
                  service_id: f.service_id === s.id ? null : s.id,
                  service_name: f.service_id === s.id ? null : s.title,
                }))}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${form.service_id === s.id ? "border-primary bg-primary/10" : stepIsDark ? "border-white/10 bg-white/5" : "border-gray-100 bg-gray-50"}`}>
                  {s.image_url ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      <BeautyImage src={s.image_url} alt={s.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Star className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className={`text-[13px] font-black ${stepIsDark ? "text-white" : "text-gray-900"}`}>{s.title}</p>
                    <p className="text-[11px] font-bold text-primary">{s.price}€ • {s.duration_min} min</p>
                  </div>
                  {form.service_id === s.id && <Check className="w-5 h-5 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        )}

        {/* Sélection actuelle */}
        {(form.product_name || form.service_name) && (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: stepIsDark ? "rgba(34,197,94,0.1)" : "#f0fdf4", border: `1px solid ${stepIsDark ? "rgba(34,197,94,0.2)" : "#dcfce7"}` }}>
            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
            <div className="flex-1">
              {form.product_name && <p className={`text-[12px] font-black ${stepIsDark ? "text-white" : "text-gray-900"}`}>Produit : {form.product_name}</p>}
              {form.service_name && <p className={`text-[12px] font-black ${stepIsDark ? "text-white" : "text-gray-900"}`}>Service : {form.service_name}</p>}
              <button onClick={() => setForm(f => ({ ...f, product_id: null, product_name: null, product_img: null, service_id: null, service_name: null }))}
                className="text-[11px] text-red-400 font-bold mt-0.5">Retirer le lien</button>
            </div>
          </div>
        )}
      </div>
      {bottomBar()}
    </div>
  );

  // ── STEP 5: Confirmation ────────────────────────────────────────────────────
  if (step === 5) return (
    <div className="fixed inset-0 z-50 flex flex-col font-display" style={{ background: stepIsDark ? "#0a0a14" : "#fff" }}>
      <StepBar step={5} total={5} label="PUBLIER" isDark={stepIsDark} />
      <div className="absolute top-5 left-5">
        <button onClick={onClose} className={`w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${stepIsDark ? "bg-white/10" : "bg-gray-100"}`}>
          <X className={`w-5 h-5 ${stepIsDark ? "text-white" : "text-gray-700"}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 hide-scrollbar space-y-4">
        <div>
          <h2 className={`text-[26px] font-black mb-1 ${stepIsDark ? "text-white" : "text-gray-900"}`}>Tout est prêt !</h2>
          <p className={`text-[13px] font-medium ${stepIsDark ? "text-white/50" : "text-gray-500"}`}>Vérifiez avant de publier.</p>
        </div>

        {/* Preview */}
        <div className={`rounded-3xl overflow-hidden h-52 ${stepIsDark ? "border border-white/10" : "border border-gray-100"}`}>
          {form.video_url ? (
            <video src={form.video_url} className="w-full h-full object-cover" muted={false} />
          ) : (
            <ImageSlider images={form.images} style={getImageStyle()} />
          )}
        </div>

        {/* Infos */}
        <div className={`rounded-2xl p-4 space-y-2 ${stepIsDark ? "bg-white/5" : "bg-gray-50"}`}>
          <div className="flex justify-between">
            <span className={`text-[12px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Type</span>
            <span className="text-[12px] font-black text-primary uppercase">{form.pubType}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-[12px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Photos</span>
            <span className={`text-[12px] font-black ${stepIsDark ? "text-white" : "text-gray-900"}`}>{form.images.length}</span>
          </div>
          <div className="flex justify-between">
            <span className={`text-[12px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Portée</span>
            <span className={`text-[12px] font-black uppercase ${stepIsDark ? "text-white" : "text-gray-900"}`}>{form.visibility}</span>
          </div>
          {(form.product_name || form.service_name) && (
            <div className="flex justify-between">
              <span className={`text-[12px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/40" : "text-gray-400"}`}>Lié à</span>
              <span className="text-[12px] font-black text-primary">{form.product_name || form.service_name}</span>
            </div>
          )}
        </div>

        {form.caption && (
          <div className="rounded-2xl p-4" style={{ background: stepIsDark ? "rgba(249,115,22,0.1)" : "#fff7ed", border: `1px solid ${stepIsDark ? "rgba(249,115,22,0.2)" : "#ffedd5"}` }}>
            <p className={`text-[13px] font-medium italic ${stepIsDark ? "text-white/70" : "text-gray-700"}`}>"{form.caption}"</p>
          </div>
        )}

        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: stepIsDark ? "rgba(34,197,94,0.1)" : "#f0fdf4", border: `1px solid ${stepIsDark ? "rgba(34,197,94,0.2)" : "#dcfce7"}` }}>
          <CheckCircle2 className="w-7 h-7 text-green-500 shrink-0" />
          <div>
            <p className={`text-[14px] font-black uppercase tracking-widest ${stepIsDark ? "text-white" : "text-gray-900"}`}>Prêt à publier !</p>
            <p className="text-[12px] font-medium text-green-500">Votre contenu sera visible dans les Réels.</p>
          </div>
        </div>
      </div>
      {/* Final buttons */}
      <div className={`px-5 py-4 border-t flex items-center gap-3 ${stepIsDark ? "bg-[#0a0a14] border-white/10" : "bg-white border-gray-100"}`}>
        <button onClick={draft} className={`px-5 py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all ${stepIsDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-600"}`}>Brouillon</button>
        <button onClick={back} className={`px-5 py-3.5 text-[12px] font-black uppercase tracking-widest ${stepIsDark ? "text-white/60" : "text-gray-600"}`}>Retour</button>
        <button onClick={publish} className="flex-1 bg-primary text-white font-black text-[14px] uppercase tracking-widest py-3.5 rounded-2xl shadow-lg shadow-primary/30 active:scale-95 transition-all">Publier ✦</button>
      </div>
    </div>
  );

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Publication() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark" || theme === "night";
  const [activeFilter, setActiveFilter] = useState("Tous");
  // Affichage direct depuis le cache : première peinture avec les dernières
  // publications connues, rafraîchissement réseau en arrière-plan sans vider l'affichage.
  const cacheKey = user?.email ? `publication_${user.email}` : null;
  const [publications, setPublications] = useCachedState(cacheKey, [], c => c?.publications || []);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [publishing, setPublishing] = useState(false);
  const [mainTab, setMainTab] = useState("publier"); // "live" | "publier" | "creer"
  const [activeTool, setActiveTool] = useState(null); // "editeur" | "autocut" | "legendes" | "detourage"
  const [editingPub, setEditingPub] = useState(null); // publication being edited
  const [showVideoEditorDirect, setShowVideoEditorDirect] = useState(false);
  const [directVideoUrl, setDirectVideoUrl] = useState(null);

  // Détecter si un brouillon local existe
  const [hasDraft, setHasDraft] = useState(() => {
    try { return !!localStorage.getItem(DRAFT_KEY); } catch { return false; }
  });

  // Rafraîchir le flag quand le wizard se ferme
  const handleWizardClose = () => {
    setShowWizard(false);
    setEditingPub(null);
    try { setHasDraft(!!localStorage.getItem(DRAFT_KEY)); } catch { setHasDraft(false); }
  };

  const editPub = (pub) => {
    setEditingPub(pub);
    setShowWizard(true);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data, error } = await supabase
          .from("Reel")
          .select("*")
          .eq("created_by_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        setPublications(data || []);
        mergePageCache(cacheKey, { publications: data || [] });
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  // Génère une miniature depuis la première frame d'une vidéo
  const generateVideoThumbnail = (videoUrl) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.currentTime = 0.5;
      video.muted = true;
      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 1136;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (!blob) { resolve(null); return; }
          const file = new File([blob], "thumb.jpg", { type: "image/jpeg" });
          const { file_url } = await uploadFile({ file }).catch(() => ({ file_url: null }));
          resolve(file_url);
        }, "image/jpeg", 0.85);
      }, { once: true });
      video.addEventListener("error", () => resolve(null), { once: true });
      video.load();
    });
  };

  const handlePublish = async (form) => {
    setPublishing(true);
    localStorage.removeItem(DRAFT_KEY);
    const editId = form._editId || null;
    try {
      const user = await supabase.auth.getUser().then(({ data }) => data?.user).catch(() => null);
      const pubTypeToCategory = { reel: "Réels", tuto: "Tutos", conseil: "Conseils" };

      let thumbnail = form.images[0] || "";
      if (form.video_url && !form.images[0]) {
        const generatedThumb = await generateVideoThumbnail(form.video_url);
        if (generatedThumb) thumbnail = generatedThumb;
      }

      const payload = {
        title: form.caption || "Ma publication",
        description: form.caption,
        images: form.images.length > 0 ? form.images : (thumbnail ? [thumbnail] : []),
        video_url: form.video_url || undefined,
        thumbnail_url: thumbnail,
        author_email: user?.email || "",
        author_name: user?.full_name || "",
        author_avatar: user?.avatar_url || undefined,
        created_by_id: user?.id || undefined,
        category: pubTypeToCategory[form.pubType] || "Réels",
        status: "publie",
        product_id: form.product_id || null,
        product_name: form.product_name || null,
        product_img: form.product_img || null,
        service_id: form.service_id || null,
        service_name: form.service_name || null,
      };

      let reel;
      if (editId) {
        const res = await entities.Reel.update(editId, payload);
        reel = res?.data?.reel || res?.result || res || { ...payload, id: editId };
      } else {
        const res = await entities.Reel.create(payload);
        reel = res?.data?.reel || res?.result || res;
      }

      if (editId) {
        setPublications(prev => {
          const next = prev.map(p => p.id === editId ? { ...p, ...reel } : p);
          mergePageCache(cacheKey, { publications: next });
          return next;
        });
      } else {
        setPublications(prev => {
          const next = [reel, ...prev];
          mergePageCache(cacheKey, { publications: next });
          return next;
        });
      }
      setEditingPub(null);
      setShowWizard(false);
    } catch (err) {
      alert("Erreur lors de la publication : " + err.message);
    }
    setPublishing(false);
  };

  const handleDraft = async (form) => {
    localStorage.removeItem(DRAFT_KEY);
    const editId = form._editId || null;
    try {
      const pubTypeToCategory = { reel: "Réels", tuto: "Tutos", conseil: "Conseils" };
      const payload = {
        title: form.caption || "Brouillon",
        description: form.caption,
        images: form.images,
        video_url: form.video_url || undefined,
        thumbnail_url: form.images[0] || "",
        author_email: user?.email || "",
        author_name: user?.full_name || "",
        created_by_id: user?.id || undefined,
        category: pubTypeToCategory[form.pubType] || "Réels",
        pub_type: form.pubType,
        status: "brouillon",
        product_id: form.product_id || null,
        product_name: form.product_name || null,
        product_img: form.product_img || null,
        service_id: form.service_id || null,
        service_name: form.service_name || null,
      };

      let reel;
      if (editId) {
        const res = await entities.Reel.update(editId, payload);
        reel = res?.data?.reel || res?.result || res || { ...payload, id: editId };
      } else {
        const res = await entities.Reel.create(payload);
        reel = res?.data?.reel || res?.result || res;
      }

      if (editId) {
        setPublications(prev => {
          const next = prev.map(p => p.id === editId ? { ...p, ...reel } : p);
          mergePageCache(cacheKey, { publications: next });
          return next;
        });
      } else {
        setPublications(prev => {
          const next = [reel, ...prev];
          mergePageCache(cacheKey, { publications: next });
          return next;
        });
      }
      setEditingPub(null);
      setShowWizard(false);
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  const deletePub = async (id) => {
    await entities.Reel.delete(id);
    setPublications(prev => {
      const next = prev.filter(p => p.id !== id);
      mergePageCache(cacheKey, { publications: next });
      return next;
    });
  };

  const catToFilter = { "Réels": "Tous", "Tutos": "Tutos", "Conseils": "Conseils" };
  const filtered = activeFilter === "Tous" ? publications : publications.filter(p => p.category === activeFilter || p.pub_type === activeFilter.toLowerCase());

  // ── Onglet CRÉER ─────────────────────────────────────────────────────────────
  const TOOLS_CREER = [
    {
      id: "editeur",
      label: "Éditeur de photos",
      emoji: "🪄",
      desc: "Retouches, filtres, recadrage",
      gradient: "from-purple-600 to-violet-500",
      bg: "bg-purple-50",
      tag: "PHOTOS",
      tagColor: "bg-purple-100 text-purple-600",
    },
    {
      id: "autocut",
      label: "AutoCut",
      emoji: "✂️",
      desc: "Coupes auto, silences, rythme",
      gradient: "from-blue-600 to-cyan-500",
      bg: "bg-blue-50",
      tag: "VIDÉO",
      tagColor: "bg-blue-100 text-blue-600",
    },
    {
      id: "legendes",
      label: "Légendes",
      emoji: "💬",
      desc: "Textes animés, styles, IA",
      gradient: "from-green-600 to-emerald-500",
      bg: "bg-green-50",
      tag: "TEXTE",
      tagColor: "bg-green-100 text-green-600",
    },
    {
      id: "detourage",
      label: "Détourage",
      emoji: "🎭",
      desc: "Suppression de fond IA",
      gradient: "from-pink-600 to-rose-500",
      bg: "bg-pink-50",
      tag: "IA",
      tagColor: "bg-pink-100 text-pink-600",
    },
  ];

  const CreerPage = () => (
    <div className="px-4 pt-4 pb-10">
      {/* Hero banner */}
      <div className="relative bg-gradient-to-br from-[#1a2035] to-[#0d0d1a] rounded-3xl p-5 mb-5 overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <span className="text-primary text-[10px] font-black uppercase tracking-widest">Studio Pro ✦</span>
          <h2 className="text-white text-[22px] font-black mt-1 leading-tight">Créez du contenu<br />professionnel</h2>
          <p className="text-white/50 text-[12px] font-medium mt-1.5">4 outils puissants pour sublimer votre contenu</p>
          <button onClick={() => { setDirectVideoUrl(null); setShowVideoEditorDirect(true); }}
            className="mt-3 bg-primary text-white font-black text-[12px] uppercase tracking-widest px-5 py-2.5 rounded-2xl active:scale-95 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle publication
          </button>
        </div>
      </div>

      {/* 4 outils en grille 2x2 */}
      <p className={`text-[11px] font-black uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Outils créatifs</p>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {TOOLS_CREER.map(tool => (
          <button key={tool.id} onClick={() => setActiveTool(tool.id)}
            className={`rounded-3xl p-4 text-left active:scale-[0.97] transition-all shadow-sm border ${isDark ? "bg-white/5 border-white/10" : `${tool.bg} border-white`}`}>
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center mb-3 shadow-lg`}>
              <span className="text-[22px]">{tool.emoji}</span>
            </div>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${tool.tagColor} uppercase tracking-wider`}>{tool.tag}</span>
            <p className={`font-black text-[14px] mt-1.5 ${isDark ? "text-white" : "text-gray-900"}`}>{tool.label}</p>
            <p className={`text-[11px] font-medium mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>{tool.desc}</p>
          </button>
        ))}
      </div>

      {/* Nouvelle vidéo + Brouillons */}
      <p className={`text-[11px] font-black uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Publier</p>
      <div className="flex gap-3 mb-5">
        <button onClick={() => { setDirectVideoUrl(null); setShowVideoEditorDirect(true); }}
          className={`flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-3xl border-2 border-dashed active:scale-[0.98] transition-all shadow-sm ${isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
            <Plus className={`w-6 h-6 ${isDark ? "text-white/40" : "text-gray-500"}`} />
          </div>
          <span className={`text-[13px] font-black ${isDark ? "text-white" : "text-gray-800"}`}>Nouvelle vidéo</span>
          <span className={`text-[10px] font-medium ${isDark ? "text-white/30" : "text-gray-400"}`}>Photo · Vidéo · Texte</span>
        </button>
        <button
          onClick={() => { setMainTab("publier"); }}
          className="w-36 flex flex-col items-center justify-center gap-2 py-5 bg-[#1a2035] rounded-3xl shadow-sm active:scale-[0.98] transition-all">
          <BookOpen className="w-6 h-6 text-white" />
          <span className="text-[13px] font-black text-white">Brouillons</span>
          <span className="text-[10px] text-white/40 font-bold">
            {publications.filter(p => p.status === "brouillon").length} enregistré(s)
          </span>
        </button>
      </div>

      {/* Récents */}
      {publications.filter(p => p.status === "publie").length > 0 && (
        <>
          <p className={`text-[11px] font-black uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-gray-400"}`}>Récemment publiés</p>
          <div className="grid grid-cols-3 gap-2">
            {publications.filter(p => p.status === "publie").slice(0, 6).map(pub => (
              <div key={pub.id} className={`aspect-square rounded-2xl overflow-hidden ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                {(pub.thumbnail_url || (pub.images && pub.images[0]))
                  ? <BeautyImage src={pub.thumbnail_url || pub.images[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Camera className={`w-6 h-6 ${isDark ? "text-white/10" : "text-gray-300"}`} /></div>
                }
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Éditeur vidéo plein écran — rendu séparé pour fiabilité
  if (showVideoEditorDirect) {
    return createPortal(
      <VideoEditor
        videoUrl={directVideoUrl}
        sound={null}
        soundUrl={null}
        onClose={() => { setShowVideoEditorDirect(false); setDirectVideoUrl(null); }}
        onAddSound={() => {}}
        onRemoveSound={() => {}}
        onDone={(edits) => {
          setShowVideoEditorDirect(false);
          setDirectVideoUrl(null);
        }}
      />,
      document.body
    );
  }

  return (
    <div className={`font-display min-h-full flex flex-col ${isDark ? "bg-[#0a0a14]" : "bg-[#f5f5f5]"}`}>
      {showWizard && (
        <PublicationWizard
          onClose={handleWizardClose}
          onPublish={handlePublish}
          onDraft={handleDraft}
          editData={editingPub}
        />
      )}

      {/* Overlays outils créatifs */}
      {activeTool === "editeur" && (
        <EditeurPhotos
          onClose={() => setActiveTool(null)}
          onDone={(result) => { setActiveTool(null); setShowWizard(true); }}
        />
      )}
      {activeTool === "autocut" && (
        <AutoCut
          onClose={() => setActiveTool(null)}
          onDone={(result) => { setActiveTool(null); setShowWizard(true); }}
        />
      )}
      {activeTool === "legendes" && (
        <Legendes
          onClose={() => setActiveTool(null)}
          onDone={(result) => { setActiveTool(null); setShowWizard(true); }}
        />
      )}
      {activeTool === "detourage" && (
        <Detourage
          onClose={() => setActiveTool(null)}
          onDone={(result) => { setActiveTool(null); setShowWizard(true); }}
        />
      )}

      {/* Header */}
      <PageHeader
        title="Studio Pro"
        dark={isDark}
        right={mainTab === "publier" ? (
          <button onClick={() => setShowWizard(true)} className="w-9 h-9 bg-primary rounded-full flex items-center justify-center active:scale-95 transition-all shadow-md shadow-primary/30">
            <Plus className="w-5 h-5 text-white" />
          </button>
        ) : null}
      />
      <div className={`px-5 pb-0 flex flex-col sticky top-16 z-40 ${isDark ? "bg-[#0a0a14]" : "bg-white"}`}>

        {/* Tabs: LIVE / PUBLIER / CRÉER */}
        <div className={`flex gap-6 justify-center border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
          {[
            { id: "live", label: "LIVE" },
            { id: "publier", label: "PUBLIER" },
            { id: "creer", label: "CRÉER" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              className={`pb-3 text-[13px] font-black border-b-2 transition-all ${mainTab === tab.id ? "text-primary border-primary" : isDark ? "text-white/40 border-transparent" : "text-gray-400 border-transparent"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE tab */}
      {mainTab === "live" && (
        <div className="px-5 pt-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h2 className={`text-[20px] font-black ${isDark ? "text-white" : "text-gray-900"}`}>Démarrer un Live</h2>
          <p className={`text-[13px] text-center font-medium ${isDark ? "text-white/50" : "text-gray-500"}`}>Diffusez en direct à votre communauté et interagissez en temps réel.</p>
          <button onClick={() => navigate("/pro/lancer-direct")}
            className="w-full bg-primary text-white font-black text-[15px] uppercase tracking-widest py-5 rounded-3xl shadow-xl shadow-primary/40 active:scale-95 transition-all flex items-center justify-center gap-3">
            <Video className="w-6 h-6" /> Lancer le Direct
          </button>
        </div>
      )}

      {/* Banner brouillon en cours */}
      {hasDraft && !showWizard && (
        <div className={`mx-4 mt-3 mb-0 rounded-2xl px-4 py-3 flex items-center gap-3 ${isDark ? "bg-amber-950/40 border border-amber-800/30" : "bg-amber-50 border border-amber-200"}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? "bg-amber-900/40" : "bg-amber-100"}`}>
            <BookOpen className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[12px] font-black ${isDark ? "text-amber-300" : "text-amber-800"}`}>Brouillon en cours</p>
            <p className={`text-[10px] font-medium ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>Votre montage a été sauvegardé</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setHasDraft(false); }}
              className="text-[10px] font-black text-amber-500 px-2 py-1 rounded-lg active:scale-95"
            >
              Effacer
            </button>
            <button
              onClick={() => setShowWizard(true)}
              className="bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl active:scale-95 shadow-sm"
            >
              Reprendre →
            </button>
          </div>
        </div>
      )}

      {/* PUBLIER tab */}
      {mainTab === "publier" && (
        <div className="px-5 pt-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Publiés", value: publications.filter(p => p.status === "publie").length },
              { label: "Likes", value: publications.reduce((s, p) => s + (p.likes || 0), 0) },
              { label: "Brouillons", value: publications.filter(p => p.status === "brouillon").length },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-3 text-center shadow-sm ${isDark ? "bg-white/5" : "bg-white"}`}>
                <p className={`text-[22px] font-black ${isDark ? "text-white" : "text-gray-900"}`}>{s.value}</p>
                <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3">
            {["Tous", "Réels", "Tutos", "Conseils"].map(c => (
              <button key={c} onClick={() => setActiveFilter(c)}
                className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === c ? "bg-primary text-white shadow-md shadow-primary/30" : isDark ? "bg-white/5 text-white/50 border border-white/10" : "bg-white text-gray-500 border border-gray-200"}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading && publications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className={`w-8 h-8 border-4 rounded-full animate-spin ${isDark ? "border-white/20 border-t-primary" : "border-gray-200 border-t-primary"}`} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Camera className={`w-12 h-12 ${isDark ? "text-white/10" : "text-gray-200"}`} />
              <p className={`text-[12px] font-medium ${isDark ? "text-white/30" : "text-gray-400"}`}>Aucune publication — créez-en une !</p>
              <button onClick={() => { setDirectVideoUrl(null); setShowVideoEditorDirect(true); }} className="mt-2 bg-primary text-white font-black text-[13px] uppercase tracking-widest px-6 py-3 rounded-2xl shadow-md shadow-primary/30 active:scale-95 transition-all">
                Créer une publication
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {filtered.map(pub => (
                <div key={pub.id} onClick={() => editPub(pub)} className={`rounded-3xl overflow-hidden shadow-sm cursor-pointer active:scale-[0.97] transition-all ${isDark ? "bg-white/5" : "bg-white"}`}>
                  <div className={`relative aspect-square ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                    {(pub.thumbnail_url || (pub.images && pub.images[0])) ? (
                      <BeautyImage src={pub.thumbnail_url || pub.images[0]} alt={pub.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className={`w-8 h-8 ${isDark ? "text-white/10" : "text-gray-300"}`} />
                      </div>
                    )}
                    {pub.images && pub.images.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5">
                        <span className="text-white text-[9px] font-black">{pub.images.length}📷</span>
                      </div>
                    )}
                    <span className={`absolute top-2 left-2 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${pub.status === "publie" ? "bg-green-500 text-white" : "bg-gray-400 text-white"}`}>
                      {pub.status === "publie" ? "Publié" : "Brouillon"}
                    </span>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => editPub(pub)} className="w-7 h-7 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                      <button onClick={() => deletePub(pub.id)} className="w-7 h-7 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center active:scale-95">
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className={`text-[13px] font-black truncate ${isDark ? "text-white" : "text-gray-900"}`}>{pub.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-primary font-black uppercase tracking-widest">{pub.pub_type || pub.category}</span>
                      <div className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        <span className={`text-[11px] font-bold ${isDark ? "text-white/50" : "text-gray-500"}`}>{pub.likes || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CRÉER tab */}
      {mainTab === "creer" && <CreerPage />}
    </div>
  );
}