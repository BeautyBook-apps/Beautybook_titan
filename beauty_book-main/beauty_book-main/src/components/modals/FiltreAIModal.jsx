import BeautyImage from '@/components/ui/BeautyImage';
import PhotoAnalysis from '@/components/maria/PhotoAnalysis';
import ImageJobHistory from '@/components/maria/ImageJobHistory';
import AICreditsCard from '@/components/ai/AICreditsCard';
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUp, Shield, Download, Heart, Check, Search, Sparkles, ImageIcon, GalleryHorizontalEnd, Loader2, Camera, Scissors } from "lucide-react";
import { entities, uploadFile } from '@/api/entities';
import { apiClient } from '@/lib/apiClient';
import { resolveSimulationCategory } from '../../../shared/simulationCategories';



// ── Cache local de la galerie (les photos ne disparaissent plus à l'actualisation) ──
const AI_STYLES_CACHE = "bb_ai_style_gallery";
const STYLE_PAGE_SIZE = 12;
function readAIStylesCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(AI_STYLES_CACHE) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((style, index, list) => (
      style?.id != null
        ? list.findIndex(item => String(item?.id) === String(style.id)) === index
        : true
    ));
  } catch { return []; }
}



const GUIDE_TIPS = [
  { icon: "😊", title: "Visage bien visible", desc: "Dégagez votre front et vos oreilles" },
  { icon: "📏", title: "Tête bien droite", desc: "Regardez l'objectif sans incliner la tête" },
  { icon: "☀️", title: "Bonne luminosité", desc: "Évitez les ombres fortes sur le visage" },
];

function imageUrl(value) {
  return typeof value === "string" ? value : value?.url || value?.src || value?.image_url || "";
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function imageFileToDataUrl(file) {
  if (!file?.type?.startsWith("image/") || typeof createImageBitmap !== "function") {
    return readBlobAsDataUrl(file);
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxSize = 1536;
    const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const compressed = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return readBlobAsDataUrl(compressed && compressed.size < file.size ? compressed : file);
  } catch {
    return readBlobAsDataUrl(file);
  }
}

async function prepareReferenceImages(urls) {
  return Promise.all(urls.slice(0, 2).map(async source => {
    if (!source || source.startsWith("data:image/")) return source;
    try {
      const response = await fetch(source, { mode: "cors" });
      if (!response.ok) return source;
      const blob = await response.blob();
      return blob.type.startsWith("image/") ? readBlobAsDataUrl(blob) : source;
    } catch {
      return source;
    }
  }));
}

function generationStepsForStyle(style) {
  const simulation = resolveSimulationCategory({ category: style?.category, subcategory: style?.subcategory, serviceCategory: style?.serviceCategory });
  const products = (style?.produits_utilises || style?.products || [])
    .map(product => typeof product === "string" ? product : product?.name || product?.title)
    .filter(Boolean)
    .slice(0, 2);
  const productDetail = products.length > 0
    ? `Références sélectionnées : ${products.join(", ")}.`
    : "Les détails du style sélectionné sont conservés.";

  if (simulation.id === 'maquillage') {
    return [
      { key: "queued", label: "Demande reçue", detail: "Votre photo et votre style sont sécurisés.", Icon: Check },
      { key: "analyzing", label: "Analyse du visage", detail: "Notre IA repère les zones à préserver.", Icon: ImageIcon },
      { key: "transforming", label: "Application du maquillage", detail: productDetail, Icon: Sparkles },
      { key: "finalizing", label: "Finalisation du résultat", detail: "Encore quelques secondes avant votre aperçu.", Icon: Sparkles },
    ];
  }
  if (simulation.id === 'manucure' || simulation.id === 'pedicure') {
    return [
      { key: "queued", label: "Demande reçue", detail: "Votre photo et votre style sont sécurisés.", Icon: Check },
      { key: "analyzing", label: simulation.id === 'pedicure' ? "Analyse des ongles des pieds" : "Analyse des ongles des mains", detail: "Notre IA repère uniquement les ongles visibles.", Icon: ImageIcon },
      { key: "transforming", label: simulation.action, detail: productDetail, Icon: Sparkles },
      { key: "finalizing", label: "Finalisation du résultat", detail: "Encore quelques secondes avant votre aperçu.", Icon: Sparkles },
    ];
  }
  if (simulation.id === 'tatouage' || simulation.id === 'piercing') {
    return [
      { key: "queued", label: "Demande reçue", detail: "Votre photo et votre motif sont sécurisés.", Icon: Check },
      { key: "analyzing", label: "Analyse de la zone", detail: "Notre IA isole la zone à modifier.", Icon: ImageIcon },
      { key: "transforming", label: simulation.action, detail: productDetail, Icon: Sparkles },
      { key: "finalizing", label: "Finalisation du résultat", detail: "Encore quelques secondes avant votre aperçu.", Icon: Sparkles },
    ];
  }
  if (['perruque', 'tresses', 'extensions', 'barbe', 'cils', 'epilation', 'soin'].includes(simulation.id)) return [
    { key: "queued", label: "Demande reçue", detail: "Votre photo et votre style sont sécurisés.", Icon: Check },
    { key: "analyzing", label: `Analyse : ${simulation.target}`, detail: "Notre IA préserve toutes les zones hors cible.", Icon: ImageIcon },
    { key: "transforming", label: simulation.action, detail: productDetail, Icon: Sparkles },
    { key: "finalizing", label: "Finalisation du résultat", detail: "Encore quelques secondes avant votre aperçu.", Icon: Sparkles },
  ];
  return [
    { key: "queued", label: "Demande reçue", detail: "Votre photo et votre style sont sécurisés.", Icon: Check },
    { key: "analyzing", label: "Analyse de l’image", detail: "Notre IA prépare les éléments à conserver.", Icon: ImageIcon },
    { key: "transforming", label: simulation.action, detail: productDetail, Icon: Scissors },
    { key: "finalizing", label: "Finalisation du résultat", detail: "Encore quelques secondes avant votre aperçu.", Icon: Sparkles },
  ];
}

function styleReferenceImages(style) {
  return [...new Set([
    ...(Array.isArray(style?.allImages) ? style.allImages : []),
    style?.img,
  ].map(imageUrl).filter(Boolean))].slice(0, 8);
}

function simulationForStyle(style) {
  return resolveSimulationCategory({ category: style?.category, subcategory: style?.subcategory, serviceCategory: style?.serviceCategory });
}

// Les galeries de styles peuvent contenir plus d'une centaine de photos.
// Ne créer l'élément image que lorsqu'il approche de la fenêtre visible afin
// d'éviter un pic mémoire sur les appareils mobiles pendant « Voir plus ».
function DeferredStyleImage({ src, alt, className = "" }) {
  const hostRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "320px 0px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={hostRef} className="block h-full w-full overflow-hidden bg-gray-100">
      {shouldLoad ? (
        <BeautyImage
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className={className}
        />
      ) : null}
    </span>
  );
}



export default function FiltreAIModal({ styleTitle, initialStyle = null, onClose, onResultSaved, favoriteStyles = [] }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(() => (initialStyle?.id || initialStyle?.label ? 2 : 1));
  const [guideReturnStep, setGuideReturnStep] = useState(null);
  const [guidePage, setGuidePage] = useState(1);
  const [userPhoto, setUserPhoto] = useState(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState(null);
  const [userPhotoUploadedUrl, setUserPhotoUploadedUrl] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(() => initialStyle);
  const stylesExpanded = !initialStyle;
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [generationPhase, setGenerationPhase] = useState("queued");
  const [liked, setLiked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [styleSearch, setStyleSearch] = useState("");
  const [comparePos, setComparePos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [styles, setStyles] = useState(() => readAIStylesCache());
  const [loadingStyles, setLoadingStyles] = useState(() => readAIStylesCache().length === 0);
  const [visibleCount, setVisibleCount] = useState(12);
  const [errorMsg, setErrorMsg] = useState(null);
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const selectedSimulation = simulationForStyle(selectedStyle);
  const simulationCta = selectedSimulation.id === 'coiffure' ? 'Générer ma coiffure' : 'Générer ma simulation';
  const compareRef = useRef(null);
  const fileInputRef = useRef(null);
  const modalScrollRef = useRef(null);

  useEffect(() => {
    if (step !== 3) return undefined;
    const timer = setInterval(() => {
      setProgress(current => {
        const next = Math.min(92, current < 24 ? current + 4 : current < 70 ? current + 2 : current + 1);
        setGenerationPhase(next < 22 ? "queued" : next < 44 ? "analyzing" : next < 78 ? "transforming" : "finalizing");
        return next;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [step]);

  // Charger les styles : UNIQUEMENT les publications de l'onglet Style (entité Style).
  // Affichage immédiat depuis le cache local, rafraîchissement réseau en arrière-plan.
  useEffect(() => {
    const loadStyles = async () => {
      try {
        const dbStyles = await entities.Style.filter({ status: "publie" }, "-created_at", 120).catch(() => []);
        const realStyles = dbStyles
          .filter(s => s.images?.length > 0 || s.thumbnail_url)
          .map(s => ({
            id: s.id,
            label: s.title || s.name || "Style",
            img: imageUrl(s.images?.[0]) || imageUrl(s.thumbnail_url),
            allImages: [...(s.images || []), s.thumbnail_url].map(imageUrl).filter(Boolean),
            author: s.author_name || null,
            category: s.category,
            subcategory: s.subcategory,
            produits_utilises: s.produits_utilises || [],
          }))
          // Une publication peut être renvoyée plusieurs fois après une
          // fusion de cache. Ne garder qu'une carte par identifiant évite les
          // clés React dupliquées et les rendus inutiles.
          .filter((style, index, list) => list.findIndex(item => String(item.id) === String(style.id)) === index);

        // N'écraser le cache que si le réseau a renvoyé des données :
        // les photos restent visibles même en cas d'échec réseau.
        if (realStyles.length > 0) {
          setStyles(realStyles);
          try { localStorage.setItem(AI_STYLES_CACHE, JSON.stringify(realStyles)); } catch {}
        }
      } catch (err) {
        console.error("Failed to load styles:", err);
      }
      setLoadingStyles(false);
    };
    loadStyles();
  }, []);

  const favIds = new Set(favoriteStyles.map(f => f.id));
  const favStylesList = styles.filter(r => favIds.has(r.id));
  const nonFavStylesList = styles.filter(r => !favIds.has(r.id));
  const filteredStyles = styleSearch.trim()
    ? styles.filter(r => r.label.toLowerCase().includes(styleSearch.toLowerCase()))
    : [...favStylesList, ...nonFavStylesList];

  // Pagination : 12 par 12 avec bouton « Voir plus »
  const visibleStyles = filteredStyles.slice(0, visibleCount);
  useEffect(() => { setVisibleCount(STYLE_PAGE_SIZE); }, [styleSearch]);

  const showMoreStyles = () => {
    setVisibleCount(current => Math.min(current + STYLE_PAGE_SIZE, filteredStyles.length));
  };

  // Pre-select the exact style sent by the detail page. We keep the local
  // payload visible immediately, then enrich it with the canonical gallery
  // record as soon as the published styles arrive.
  useEffect(() => {
    if (initialStyle?.id) {
      const canonical = styles.find(r => String(r.id) === String(initialStyle.id));
      if (canonical) {
        setSelectedStyle(current => {
          if (current && String(current.id) !== String(initialStyle.id)) return current;
          return { ...initialStyle, ...canonical, allImages: canonical.allImages?.length ? canonical.allImages : initialStyle.allImages };
        });
      }
      return;
    }
    if (styleTitle && styles.length > 0) {
      const title = styleTitle.toLowerCase();
      const match = styles.find(r => r.label.toLowerCase() === title)
        || styles.find(r => r.label.toLowerCase().includes(title) || title.includes(r.label.toLowerCase()));
      if (match) setSelectedStyle(match);
    }
  }, [initialStyle, styleTitle, styles]);

  const handleCompareMove = (clientX) => {
    if (!compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setComparePos(Math.round((x / rect.width) * 100));
  };
  const onMouseMove = (e) => { if (isDragging) handleCompareMove(e.clientX); };
  const onTouchMove = (e) => { if (isDragging) handleCompareMove(e.touches[0].clientX); };

  const handlePhotoUpload = (file) => {
    if (!file) return;
    setUserPhoto(file);
    setUserPhotoUrl(URL.createObjectURL(file));
    setUserPhotoUploadedUrl(null);
    setPhotoAnalysis(null);
    analyzePhoto(file);
  };

  const analyzePhoto = async (file) => {
    setAnalyzingPhoto(true);
    setPhotoAnalysis(null);
    setErrorMsg(null);
    try {
      const { file_url } = await uploadFile({ file }, 'uploads');
      setUserPhotoUploadedUrl(file_url);

      // Keep upload validation local and let the server perform the real image
      // transformation during the generation job.
      setPhotoAnalysis({
        mode: 'upload_ready',
        status: 'exploitable_avec_restrictions',
        suggestion: 'Photo importée. Notre IA vérifiera la cohérence de la référence pendant la génération.',
      });
    } catch (e) {
      console.error('Photo analysis failed:', e);
      setPhotoAnalysis({ mode: 'upload_error', suggestion: 'La photo n’a pas pu être importée. Réessayez.' });
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const startSimulation = async () => {
    if (!userPhoto || !selectedStyle) return;
    setStep(3);
    setProgress(6);
    setGenerationPhase('queued');
    setErrorMsg(null);
    setProgressMsg('Votre demande est dans la file d’attente…');
    try {
      let uploadedUrl = userPhotoUploadedUrl;
      if (!uploadedUrl) {
        uploadedUrl = (await uploadFile({ file: userPhoto }, 'uploads')).file_url;
        setUserPhotoUploadedUrl(uploadedUrl);
      }
      const falPhotoUrl = await imageFileToDataUrl(userPhoto);
      const referenceImages = await prepareReferenceImages(styleReferenceImages(selectedStyle));
      const response = await apiClient.callFunction('shAiTryOn', {
        // Use a data URI for the source photo so the image provider does not
        // depend on the visibility or expiration of a storage URL.
        user_photo: falPhotoUrl,
        garment_photo: referenceImages[0],
        reference_images: referenceImages,
        garment_name: `${selectedStyle.category || 'style'}: ${selectedStyle.label}`,
        styleName: selectedStyle.label,
        mode: 'hair',
        module: 'ai_style_changer',
        page: 'maria/filtre-ai',
        category: selectedStyle.category || 'coiffure',
        subcategory: selectedStyle.subcategory || null,
        service_category: selectedStyle.serviceCategory || null,
        target_area: simulationForStyle(selectedStyle).target,
        operation: 'style_change',
      }, {
        onProgress: job => {
          if (job.status === 'queued') {
            setGenerationPhase('queued');
            setProgress(current => Math.max(current, 12));
            setProgressMsg('Votre demande est dans la file d’attente…');
          } else if (job.status === 'processing') {
            setGenerationPhase('analyzing');
            setProgress(current => Math.max(current, 30));
            setProgressMsg('Analyse de l’image en cours…');
          }
        }
      });
      if (!response.data?.result_url) throw new Error('Aucun résultat généré.');
      setGenerationPhase('finalizing');
      setProgress(100);
      setProgressMsg('Résultat finalisé.');
      setResult({
        generatedImageUrl: response.data.result_url,
        styleLabel: selectedStyle.label,
        styleImg: selectedStyle.img,
        userPhotoUrl,
        author: selectedStyle.author,
        fallback: false
      });
      setStep(4);
    } catch (e) {
      const message = e.code === 'AI_NOT_CONFIGURED'
        ? 'Le service de simulation IA n’est pas encore configuré sur le serveur.'
        : e.code === 'DATABASE_NOT_CONFIGURED'
          ? 'Le serveur de simulation n’est pas encore connecté à sa base de données.'
          : e.code === 'AI_QUOTA_REACHED'
            ? 'Votre quota gratuit du jour est épuisé. Achetez un pack de crédits pour continuer.'
          : ['AUTH_REQUIRED', 'SESSION_INVALID'].includes(e.code)
          ? 'Connectez-vous pour lancer une simulation.'
          : ['AI_PROVIDER_ERROR', 'FAL_PROVIDER_ERROR', 'FAL_NETWORK_ERROR', 'FAL_TIMEOUT', 'FAL_IMAGE_UNAVAILABLE', 'MUSE_PROVIDER_ERROR', 'MUSE_NETWORK_ERROR', 'MUSE_BILLING_REQUIRED', 'INVALID_IMAGE_RESULT'].includes(e.code)
            ? 'La génération n’a pas pu aboutir. Vérifiez que le serveur est démarré puis réessayez.'
          : e.message || 'La simulation n’a pas pu être générée.';
      setErrorMsg(message);
      if (e.code === 'AI_QUOTA_REACHED') {
        setStep(2);
        return;
      }
      setResult({
        error: message,
        errorCode: e.code,
        styleLabel: selectedStyle.label,
        userPhotoUrl,
        fallback: false
      });
      setStep(4);
    }
  };

  const handleDownload = async () => {
    const imgUrl = result?.generatedImageUrl;
    if (!imgUrl) return;
    try {
      const res = await fetch(imgUrl);
      if(!res.ok)throw new Error('Téléchargement indisponible. Rouvrez le résultat depuis votre historique.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hairstyle-${result.styleLabel?.replace(/\s/g, "-")}.jpg`;
      link.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch(e) {setErrorMsg(e.message||'Le téléchargement a échoué.');}
  };

  const handleSaveToMaria=async()=>{if(!result?.generatedImageUrl||!onResultSaved)return;try{await onResultSaved({styleLabel:result.styleLabel,styleImg:result.generatedImageUrl,userPhotoUrl:result.userPhotoUrl,message:'Aperçu de style généré par IA.',savedAt:new Date().toISOString()});setLiked(true);}catch(e){setErrorMsg(e.message||'Le partage a échoué.');}};

  const generationSteps = generationStepsForStyle(selectedStyle);
  const activeGenerationIndex = Math.max(0, generationSteps.findIndex(item => item.key === generationPhase));

  const modal = (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end">
      <div ref={modalScrollRef} className="w-full bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <button
            onClick={() => {
              if (step === 1 && guidePage > 1) {
                setGuidePage(page => page - 1);
              } else if (step === 1 && guideReturnStep) {
                setStep(guideReturnStep);
                setGuideReturnStep(null);
              } else if (step > 1 && step < 3) {
                setStep(step - 1);
              } else {
                onClose();
              }
            }}
            className="w-8 h-8 flex items-center justify-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-[17px] font-black text-gray-900">
              {step === 1 && `Guide Photo · ${guidePage}/3`}
              {step === 2 && "Choisir un Style"}
              {step === 3 && "Génération IA…"}
              {step === 4 && "Votre Simulation"}
              {step === 5 && "Historique des générations"}
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {(step === 1 ? [1, 2, 3] : [1, 2, 3, 4]).map(s => (
                <div key={s} className={`h-1 rounded-full transition-all ${step === 1 ? (s === guidePage ? "w-6 bg-primary" : s < guidePage ? "w-3 bg-primary/40" : "w-3 bg-gray-200") : (s === step ? "w-6 bg-primary" : s < step ? "w-3 bg-primary/40" : "w-3 bg-gray-200")}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 text-[18px]">✕</button>
        </div>

        <div className="flex-1 px-5 py-6">{errorMsg && <p role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-800 text-sm">{errorMsg}</p>}
          {[2,4].includes(step) && <button onClick={() => { setErrorMsg(null); setStep(5); }} className="mb-4 min-h-11 w-full rounded-xl border border-orange-100 bg-orange-50 px-4 text-sm font-bold text-primary">Historique des générations</button>}
          {step === 5 && <ImageJobHistory kinds="hair" onClose={() => setStep(result ? 4 : 2)} onSelect={(url, job) => {
            setResult({generatedImageUrl:url,styleLabel:job.label,styleImg:url,fromHistory:true});
            setErrorMsg(null); setDownloaded(false); setLiked(false); setStep(4);
          }} />}

          {/* ── STEP 1: Guide ── */}
          {step === 1 && (
            <div className="space-y-5">
              {guidePage === 1 && (
                <>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-3xl p-6 text-center">
                    <span className="text-[52px]">✨</span>
                    <h3 className="text-[24px] font-black text-gray-900 mt-3">Filtre IA</h3>
                    <p className="text-[22px] font-black text-primary">Simulation personnalisée</p>
                    <p className="text-[13px] text-gray-600 mt-3 leading-relaxed">
                      Notre IA génère une <strong>vraie photo de vous</strong> en ne transformant que la zone du style choisi.
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-1.5 bg-white/70 rounded-2xl px-3 py-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-black text-primary">Propulsé par BeautyBook IA</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {GUIDE_TIPS.map((tip, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="text-[28px] shrink-0">{tip.icon}</span>
                        <div>
                          <p className="text-[14px] font-black text-gray-900">{tip.title}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{tip.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {guidePage === 2 && (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-blue-50 p-7 text-center border border-blue-100">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm"><Camera className="h-10 w-10 text-blue-500" /></div>
                    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Étape 2</p>
                    <h3 className="mt-2 text-[22px] font-black text-gray-900">Importez votre photo</h3>
                    <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{selectedSimulation.photoHint}</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      "Utilisez une photo récente et de bonne qualité",
                      "Gardez la tête droite face à l’objectif",
                      "Évitez les filtres et les visages masqués",
                    ].map(text => <div key={text} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-[13px] font-bold text-gray-700"><Check className="h-5 w-5 shrink-0 text-green-600" />{text}</div>)}
                  </div>
                </div>
              )}

              {guidePage === 3 && (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-purple-50 p-7 text-center border border-purple-100">
                    {selectedStyle?.img ? <BeautyImage src={selectedStyle.img} alt={selectedStyle.label} className="mx-auto h-36 w-36 rounded-3xl object-cover shadow-lg" /> : <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-3xl bg-white shadow-sm"><GalleryHorizontalEnd className="h-12 w-12 text-purple-500" /></div>}
                    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-purple-600">Étape 3</p>
                    <h3 className="mt-2 text-[22px] font-black text-gray-900">Choisissez votre style</h3>
                    <p className="mt-3 text-[13px] leading-relaxed text-gray-600">Sélectionnez un style de la galerie, puis lancez votre simulation personnalisée.</p>
                    {selectedStyle && <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[12px] font-black text-purple-700">Style prêt : {selectedStyle.label}</p>}
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-[12px] leading-relaxed text-blue-700"><Shield className="mx-auto mb-2 h-5 w-5 text-blue-500" />Vos images sont transmises de manière sécurisée au service IA.</div>
                </div>
              )}

              <div
                className="sticky bottom-0 z-10 -mx-1 mt-1 border-t border-orange-100 bg-white/95 px-1 pt-3 backdrop-blur-md"
                style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (guidePage < 3) setGuidePage(page => page + 1);
                    else { setGuideReturnStep(null); setStep(2); }
                  }}
                  aria-label={guidePage < 3 ? "Passer à l'étape suivante" : "Accéder à l'essayage"}
                  className="group flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-[14px] font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(232,115,42,0.28)] transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
                >
                  <span>{guidePage < 3 ? "SUIVANT" : "ACCÉDER À L’ESSAYAGE"}</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Photo + Style ── */}
          {step === 2 && (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => { setGuidePage(1); setGuideReturnStep(2); setStep(1); }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-primary transition-all active:scale-[0.98]"
              >
                <ImageIcon className="h-4 w-4" /> VOIR LE GUIDE PHOTO · 3 ÉTAPES
              </button>

              <AICreditsCard compact returnPath="/maria" />

              {/* Photo upload — grande zone */}
              <div>
                <h3 className="text-[15px] font-black text-gray-900 mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" strokeWidth={1.5} /> Votre photo</h3>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer active:scale-[0.98] transition-all ${userPhotoUrl ? "border-primary bg-orange-50/30 aspect-[3/4] max-w-[280px] mx-auto" : "border-primary/40 bg-primary/5 py-16"}`}
                >
                  {userPhotoUrl ? (
                    <div className="relative w-full h-full">
                      <BeautyImage src={userPhotoUrl} alt="Votre photo" className="w-full h-full object-cover rounded-3xl" />
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center border-2 border-white z-10">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black/30 to-transparent rounded-b-3xl" />
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-3 border border-primary/20">
                        <Camera className="w-8 h-8 text-primary" strokeWidth={1.5} />
                      </div>
                      <p className="text-[15px] font-black text-primary">Importer</p>
                      <p className="text-[12px] text-gray-400 font-medium mt-1">Corps entier, fond neutre</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handlePhotoUpload(e.target.files?.[0])} className="hidden" />
                {userPhotoUrl && (
                  <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-black text-primary mt-2 uppercase tracking-widest">
                    Changer de photo
                  </button>
                )}
              </div>

              {/* Analyse photo */}
              {userPhotoUrl && analyzingPhoto && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                  <p className="text-[11px] font-bold text-blue-600">Analyse de la photo en cours…</p>
                </div>
              )}
              {userPhotoUrl && !analyzingPhoto && <PhotoAnalysis analysis={photoAnalysis}/>}

              {/* Style selector */}
              <div>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h3 className="text-[15px] font-black text-gray-900 flex items-center gap-2"><GalleryHorizontalEnd className="w-4 h-4 text-primary" strokeWidth={1.5} /> Choisir un style</h3>
                </div>

              {selectedStyle && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex items-center gap-3">
                  <BeautyImage src={selectedStyle.img} alt={selectedStyle.label} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-gray-900">
                      {initialStyle ? "Style choisi depuis le détail" : "Style sélectionné"} : {selectedStyle.label}
                    </p>
                    {selectedStyle.author && (
                      <p className="text-[10px] text-primary font-bold">✦ Publié par {selectedStyle.author}</p>
                    )}
                    <p className="text-[11px] text-gray-500">BeautyBook IA va générer votre photo avec ce style</p>
                  </div>
                  {!stylesExpanded && <Check className="h-5 w-5 shrink-0 text-green-600" aria-label="Style actif" />}
                </div>
              )}

                {stylesExpanded && (
                  <>
                    <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2.5 mb-3">
                      <Search className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        value={styleSearch}
                        onChange={e => setStyleSearch(e.target.value)}
                        placeholder="Rechercher un style..."
                        className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400 font-medium"
                      />
                      {styleSearch && (
                        <button onClick={() => setStyleSearch("")} className="text-gray-400 text-[14px]" aria-label="Effacer la recherche">✕</button>
                      )}
                    </div>

                    {loadingStyles ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <>
                        {!styleSearch && favStylesList.length > 0 && (
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">❤️ Mes favoris</p>
                        )}
                        <div className="grid grid-cols-4 gap-2">
                          {visibleStyles.map(ref => (
                            <button
                              key={ref.id}
                              onClick={() => setSelectedStyle(ref)}
                              style={{ contentVisibility: "auto", containIntrinsicSize: "0 118px" }}
                              className="relative flex flex-col items-center gap-1 active:scale-95 transition-all"
                            >
                              <div className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedStyle?.id === ref.id ? "border-primary shadow-md shadow-primary/20 scale-105" : "border-transparent"}`}>
                                <DeferredStyleImage
                                  src={ref.img}
                                  alt={ref.label}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {favIds.has(ref.id) && !styleSearch && (
                                <div className="absolute top-1 left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                  <Heart className="w-2 h-2 text-white fill-white" />
                                </div>
                              )}
                              {selectedStyle?.id === ref.id && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-white">
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-tight text-center leading-tight">{ref.label}</span>
                            </button>
                          ))}
                          {filteredStyles.length === 0 && (
                            <div className="col-span-4 text-center py-6 text-[13px] text-gray-400">
                              {loadingStyles ? "" : styleSearch ? "Aucun style trouvé" : "Aucun style publié pour le moment"}
                            </div>
                          )}
                        </div>
                        {/* Voir plus : 12 styles par série */}
                        {visibleCount < filteredStyles.length && (
                          <button
                            onClick={showMoreStyles}
                            className="w-full mt-3 py-3.5 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all"
                          >
                            Voir plus ({filteredStyles.length - visibleCount} restants)
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="bg-blue-50 rounded-2xl p-3 flex items-start gap-2 border border-blue-100">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  <strong>Vie privée</strong> — Vos photos sont transmises de façon sécurisée au service IA pour générer votre simulation.
                </p>
              </div>

              <div className="sticky bottom-0 z-20 -mx-5 border-t border-orange-100 bg-white/95 px-5 pt-3 backdrop-blur-md" style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
                <button
                  onClick={startSimulation}
                  disabled={!userPhoto || !selectedStyle}
                  aria-label={userPhoto && selectedStyle ? simulationCta : "Ajoutez une photo et choisissez un style"}
                  className={`group flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl px-5 py-3 text-left transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 ${
                    userPhoto && selectedStyle
                      ? "bg-gradient-to-r from-orange-500 via-primary to-amber-500 text-white shadow-[0_12px_28px_rgba(232,115,42,0.34)] hover:shadow-[0_16px_34px_rgba(232,115,42,0.42)]"
                      : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${userPhoto && selectedStyle ? "bg-white/20" : "bg-slate-200"}`}>
                    <Sparkles className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-black uppercase tracking-[0.09em]">{simulationCta}</span>
                    <span className={`mt-0.5 block text-[10px] font-semibold ${userPhoto && selectedStyle ? "text-white/80" : "text-slate-400"}`}>
                      {userPhoto && selectedStyle ? "Créer mon aperçu personnalisé" : "Ajoutez une photo et choisissez un style"}
                    </span>
                  </span>
                  {userPhoto && selectedStyle && <ArrowRight className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />}
                </button>
                <p className="mt-2 text-center text-[10px] font-medium text-slate-400">1 génération · votre résultat sera enregistré dans votre historique privé</p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Loading ── */}
          {step === 3 && (
            <div className="relative -mx-5 -my-4 flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-slate-950 px-5 py-10">
              {userPhotoUrl ? (
                <div className="absolute inset-0">
                  <BeautyImage src={userPhotoUrl} alt="" className="h-full w-full scale-105 object-cover opacity-60 blur-sm" />
                  <div className="absolute inset-0 bg-slate-950/50" />
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/35 to-slate-950/90" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950" />
              )}

              <div className="relative z-10 w-full max-w-md">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-orange-300/50 bg-orange-400/15 shadow-[0_0_40px_rgba(249,115,22,0.25)]">
                    <Sparkles className="h-8 w-8 animate-pulse text-orange-300 motion-reduce:animate-none" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-200">BeautyBook IA</p>
                  <h3 className="mt-2 text-[24px] font-black tracking-tight text-white">Votre style prend vie</h3>
                  <p className="mt-1 text-[12px] font-medium text-white/60">Une simulation personnalisée, étape par étape</p>
                </div>

                <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Génération IA</p>
                      <p className="mt-1 text-[16px] font-black text-white">{progressMsg || "Préparation de votre demande…"}</p>
                    </div>
                    <p className="text-[25px] font-black tabular-nums text-orange-300">{Math.round(progress)}<span className="text-[14px]">%</span></p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-white/10" role="progressbar" aria-label="Progression de la génération" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 via-primary to-amber-300 shadow-[0_0_18px_rgba(251,146,60,0.7)] transition-[width] duration-700 ease-out" style={{ width: `${Math.max(progress, 4)}%` }} />
                  </div>

                  <div className="relative mt-5">
                    <div className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 bg-white/10" aria-hidden="true">
                      <div className="h-full bg-gradient-to-r from-emerald-300 via-orange-300 to-orange-400 transition-[width] duration-500" style={{ width: `${activeGenerationIndex / (generationSteps.length - 1) * 100}%` }} />
                    </div>
                    <div className="relative grid grid-cols-4 gap-1">
                      {generationSteps.map((item, index) => {
                        const active = index === activeGenerationIndex;
                        const complete = index < activeGenerationIndex || progress >= 100;
                        const Icon = item.Icon;
                        return (
                          <div key={item.key} className="flex min-w-0 flex-col items-center text-center">
                            <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${active ? "border-orange-200 bg-orange-400 text-white shadow-lg shadow-orange-500/30" : complete ? "border-emerald-200/60 bg-emerald-400/25 text-emerald-100" : "border-white/10 bg-slate-800/80 text-white/35"}`}>
                              {complete ? <Check className="h-4 w-4" /> : <Icon className={`h-4 w-4 ${active ? "animate-pulse motion-reduce:animate-none" : ""}`} />}
                              {active && <Loader2 className="absolute -right-2 -top-2 h-4 w-4 animate-spin rounded-full bg-slate-950 text-orange-200 motion-reduce:animate-none" />}
                            </div>
                            <p className={`mt-2 line-clamp-2 px-0.5 text-[9px] font-black leading-tight ${active ? "text-white" : complete ? "text-emerald-100" : "text-white/40"}`}>{item.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-400/10 px-3 py-2.5 text-center">
                      <p className="text-[11px] font-black text-white">{generationSteps[activeGenerationIndex]?.label}</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-white/55">{generationSteps[activeGenerationIndex]?.detail}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-black/15 px-3 py-2.5 text-center text-[11px] font-medium text-white/65">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-300 motion-reduce:animate-none" />
                    Résultat dans quelques secondes…
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="mx-auto mt-5 flex min-h-11 items-center justify-center rounded-xl px-4 text-[11px] font-black uppercase tracking-widest text-white/55 underline decoration-white/25 underline-offset-4 transition-all active:scale-95"
                >
                  Fermer le suivi
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Result ── */}
          {step === 4 && result && (
            <div className="space-y-5">

              {/* Badge génération */}
              <div className="flex items-center justify-center gap-2">
                <div className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 border ${result.fallback ? "bg-purple-50 border-purple-100" : "bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-100"}`}>
                  <Sparkles className={`w-3.5 h-3.5 ${result.fallback ? "text-purple-500" : "text-primary"}`} />
                  <span className={`text-[11px] font-black ${result.fallback ? "text-purple-600" : "text-primary"}`}>
                    {result.error ? "BeautyBook IA" : result.fallback ? "Généré par IA (mode secours)" : "Généré par BeautyBook IA"}
                  </span>
                </div>
              </div>
              {result.fallback && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-purple-700 font-medium">{result.fallbackMessage || "Image générée par IA"}</p>
                </div>
              )}

              {result.error ? (
                // Erreur — afficher un message clair
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                  <p className="text-[14px] font-black text-red-600 mb-2">{result.errorCode === 'IMAGE_PENDING' ? 'Suivi temporairement interrompu' : '⚠️ Génération échouée'}</p>
                  <p className="text-[12px] text-gray-600">{result.error}</p>
                  <p className="text-[11px] text-gray-500 mt-2">{result.errorCode === 'IMAGE_PENDING' ? 'Consultez l’historique pour retrouver cette demande.' : 'Vérifiez votre connexion ou réessayez dans quelques instants.'}</p>
                  {['AUTH_REQUIRED', 'SESSION_INVALID'].includes(result.errorCode) && (
                    <button
                      type="button"
                      onClick={() => { onClose?.(); navigate('/connexion'); }}
                      className="mt-4 min-h-11 rounded-xl bg-primary px-5 py-3 text-[12px] font-black text-white active:scale-[0.98] transition-transform"
                    >
                      SE RECONNECTER
                    </button>
                  )}
                </div>
              ) : result.fromHistory ? (
                <BeautyImage src={result.generatedImageUrl} alt={result.styleLabel} className="w-full rounded-2xl object-contain" />
              ) : result.fallback ? (
                /* Mode fallback — analyse IA sans image générée */
                <div className="space-y-4">
                  {/* Comparaison côte à côte */}
                  <div>
                    <p className="text-[12px] font-black text-gray-700 uppercase tracking-widest mb-2">Analyse IA</p>
                    <div className="grid grid-cols-2 gap-3">
                      {result.userPhotoUrl && (
                        <div className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-[3/4]">
                          <BeautyImage src={result.userPhotoUrl} alt="Vous" className="w-full h-full object-cover" />
                          <div className="absolute bottom-2 left-2 bg-gray-900/80 rounded-full px-2 py-0.5">
                            <span className="text-white text-[9px] font-black uppercase">VOUS</span>
                          </div>
                        </div>
                      )}
                      <div className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-[3/4]">
                        <BeautyImage src={result.styleImg} alt={result.styleLabel} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-primary/90 rounded-full px-2 py-0.5">
                          <span className="text-white text-[9px] font-black uppercase">STYLE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Score & analyse */}

                  {/* Recommandations */}
                  {result.recommendations?.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                      <p className="text-[11px] font-black text-blue-700 mb-1.5">Recommandations IA</p>
                      {result.recommendations.map((r, i) => (
                        <p key={i} className="text-[11px] text-blue-600 leading-relaxed">• {r}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Before/After Slider interactif */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-black text-gray-700 uppercase tracking-widest">Avant / Après</p>
                    <span className="text-[10px] text-gray-400 font-medium">← Glisser →</span>
                  </div>
                  <div
                    ref={compareRef}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden cursor-col-resize select-none bg-gray-100"
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onMouseMove={onMouseMove}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    onTouchMove={onTouchMove}
                  >
                    {/* APRÈS — image générée par BeautyBook IA */}
                    <div className="absolute inset-0">
                      <BeautyImage
                        src={result.generatedImageUrl}
                        alt="Après"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 bg-primary/90 rounded-full px-2 py-0.5">
                        <span className="text-white text-[9px] font-black uppercase">APRÈS</span>
                      </div>
                    </div>

                    {/* AVANT — photo originale */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}
                    >
                      <BeautyImage src={result.userPhotoUrl} alt="Avant" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2 bg-gray-900/80 rounded-full px-2 py-0.5">
                        <span className="text-white text-[9px] font-black uppercase">AVANT</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
                      style={{ left: `${comparePos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-primary">
                        <div className="flex items-center gap-0.5">
                          <ArrowLeft className="w-3 h-3 text-primary" />
                          <ArrowRight className="w-3 h-3 text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-gray-400 mt-1.5 font-medium">Glissez pour comparer l'original et la simulation IA</p>
                </div>
              )}

              {/* Info style */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <BeautyImage src={result.styleImg} alt={result.styleLabel} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div>
                    <p className="text-[13px] font-black text-gray-900">{result.styleLabel}</p>
                    {result.author && (
                      <p className="text-[11px] text-primary font-bold">✦ Style de {result.author}</p>
                    )}
                    <p className="text-[11px] text-gray-400 font-medium">{result.generatedImageUrl ? 'Image générée par BeautyBook IA' : 'Votre demande de simulation'}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDownload}
                  disabled={!result.generatedImageUrl}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 ${downloaded ? "border-green-400 bg-green-50 text-green-600" : "border-gray-200 bg-white text-gray-700"}`}
                >
                  {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  {downloaded ? "Téléchargé" : "Télécharger"}
                </button>
                <button
                  onClick={handleSaveToMaria}
                  className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all ${liked ? "bg-red-50 border border-red-200 text-red-500" : "bg-gray-100 text-gray-700 border border-transparent"}`}
                >
                  <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
                  {liked ? "Sauvegardé" : "Favoris"}
                </button>
              </div>

              <button
                onClick={() => {
                  if (selectedStyle?.id) {
                    navigate(`/style/${selectedStyle.id}`);
                    onClose();
                  }
                }}
                className="w-full bg-primary text-white font-black py-4 rounded-2xl uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/30"
              >
                Ouvrir le style
              </button>

              <button
                onClick={() => { setStep(2); setResult(null); setProgress(0); setLiked(false); setErrorMsg(null); }}
                className="w-full bg-gray-100 text-gray-700 font-black py-3.5 rounded-2xl uppercase tracking-widest active:scale-95 transition-all text-[12px]"
              >
                Recommencer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Retour en haut : apparaît à partir de la 4ᵉ série de « Voir plus » (48 styles affichés) */}
      {step === 2 && visibleCount >= 48 && (
        <button
          onClick={() => modalScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] px-5 py-2.5 bg-primary/80 backdrop-blur-sm rounded-full flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-90 transition-all"
        >
          <ArrowUp className="w-4 h-4 text-white" />
          <span className="text-[12px] font-black text-white uppercase tracking-wide">Retour en haut</span>
        </button>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
