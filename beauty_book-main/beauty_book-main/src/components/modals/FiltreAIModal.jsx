import BeautyImage from '@/components/ui/BeautyImage';
import PhotoAnalysis from '@/components/maria/PhotoAnalysis';
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUp, Shield, Download, Heart, Check, Search, Sparkles, ImageIcon, GalleryHorizontalEnd, Loader2, Camera, Scissors } from "lucide-react";
import { entities, uploadFile } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { apiClient } from '@/lib/apiClient';



// ── Cache local de la galerie (les photos ne disparaissent plus à l'actualisation) ──
const AI_STYLES_CACHE = "bb_ai_style_gallery";
function readAIStylesCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(AI_STYLES_CACHE) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}



const GUIDE_TIPS = [
  { icon: "😊", title: "Visage bien visible", desc: "Dégagez votre front et vos oreilles" },
  { icon: "📏", title: "Tête bien droite", desc: "Regardez l'objectif sans incliner la tête" },
  { icon: "☀️", title: "Bonne luminosité", desc: "Évitez les ombres fortes sur le visage" },
];



export default function FiltreAIModal({ styleTitle, onClose, onResultSaved, favoriteStyles = [] }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userPhoto, setUserPhoto] = useState(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState(null);
  const [userPhotoUploadedUrl, setUserPhotoUploadedUrl] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
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
  const compareRef = useRef(null);
  const fileInputRef = useRef(null);
  const modalScrollRef = useRef(null);

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
            img: (s.images?.[0]) || s.thumbnail_url,
            allImages: s.images || [s.thumbnail_url].filter(Boolean),
            author: s.author_name || null,
            category: s.category,
          }));

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
  useEffect(() => { setVisibleCount(12); }, [styleSearch]);

  // Pre-select style from parent
  useEffect(() => {
    if (styleTitle && styles.length > 0) {
      const match = styles.find(r =>
        styleTitle.toLowerCase().includes(r.id) ||
        r.label.toLowerCase().includes(styleTitle.toLowerCase().split(" ")[0])
      );
      setSelectedStyle(match || styles[0]);
    }
  }, [styleTitle, styles]);

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

  const analyzePhoto=async(file)=>{setAnalyzingPhoto(true);setPhotoAnalysis(null);setErrorMsg(null);try{const {file_url}=await uploadFile({file},'private-images');setUserPhotoUploadedUrl(file_url);const res=await apiClient.callFunction('analyzePhoto',{photoUrl:file_url,productName:'coiffure'});setPhotoAnalysis(res.data);}catch(e){setErrorMsg(e.message||'L’analyse de la photo a échoué.');}finally{setAnalyzingPhoto(false);}};

  const startSimulation=async()=>{if(!userPhoto||!selectedStyle)return;setStep(3);setProgress(50);setErrorMsg(null);setProgressMsg('Préparation de votre demande…');try{let uploadedUrl=userPhotoUploadedUrl;if(!uploadedUrl){uploadedUrl=(await uploadFile({file:userPhoto},'private-images')).file_url;setUserPhotoUploadedUrl(uploadedUrl);}const response=await apiClient.callFunction('shAiTryOn',{user_photo:uploadedUrl,garment_photo:selectedStyle.allImages?.filter(Boolean)[0]||selectedStyle.img,garment_name:'coiffure: '+selectedStyle.label,mode:'hair'},{onProgress:job=>setProgressMsg(job.status==='queued'?'Votre demande est dans la file d’attente…':'Génération de votre coiffure…')});if(!response.data?.result_url)throw new Error('Aucun résultat généré.');setResult({generatedImageUrl:response.data.result_url,styleLabel:selectedStyle.label,styleImg:selectedStyle.img,userPhotoUrl,author:selectedStyle.author,fallback:false});setStep(4);}catch(e){setErrorMsg(e.message);setResult({error:e.message,styleLabel:selectedStyle.label,userPhotoUrl,fallback:false});setStep(4);}};

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

  const handleSaveToMaria=async()=>{if(!result?.generatedImageUrl||!onResultSaved)return;try{await onResultSaved({styleLabel:result.styleLabel,styleImg:result.generatedImageUrl,userPhotoUrl:result.userPhotoUrl,message:'Aperçu de coiffure généré par IA.',savedAt:new Date().toISOString()});setLiked(true);}catch(e){setErrorMsg(e.message||'Le partage a échoué.');}};

  const modal = (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-end">
      <div ref={modalScrollRef} className="w-full bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <button
            onClick={() => step > 1 && step < 3 ? setStep(step - 1) : onClose()}
            className="w-8 h-8 flex items-center justify-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-[17px] font-black text-gray-900">
              {step === 1 && "Guide Photo"}
              {step === 2 && "Choisir un Style"}
              {step === 3 && "Génération IA…"}
              {step === 4 && "Votre Simulation"}
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all ${s === step ? "w-6 bg-primary" : s < step ? "w-3 bg-primary/40" : "w-3 bg-gray-200"}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 text-[18px]">✕</button>
        </div>

        <div className="flex-1 px-5 py-6">{errorMsg && <p role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-800 text-sm">{errorMsg}</p>}

          {/* ── STEP 1: Guide ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-3xl p-6 text-center">
                <span className="text-[52px]">✨</span>
                <h3 className="text-[24px] font-black text-gray-900 mt-3">AI Hairstyle</h3>
                <p className="text-[22px] font-black text-primary">Changer</p>
                <p className="text-[13px] text-gray-600 mt-3 leading-relaxed">
                  Notre IA OpenAI génère une <strong>vraie photo de vous</strong> avec la coiffure choisie en quelques secondes.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 bg-white/70 rounded-2xl px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-black text-primary">Propulsé par OpenAI AI</span>
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
              <button
                onClick={() => setStep(2)}
                className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 transition-all"
              >
                COMMENCER <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── STEP 2: Photo + Style ── */}
          {step === 2 && (
            <div className="space-y-6">
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[15px] font-black text-gray-900 flex items-center gap-2"><GalleryHorizontalEnd className="w-4 h-4 text-primary" strokeWidth={1.5} /> Choisir un style</h3>
                </div>

                <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2.5 mb-3">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    value={styleSearch}
                    onChange={e => setStyleSearch(e.target.value)}
                    placeholder="Rechercher un style..."
                    className="flex-1 bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400 font-medium"
                  />
                  {styleSearch && (
                    <button onClick={() => setStyleSearch("")} className="text-gray-400 text-[14px]">✕</button>
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
                          className="relative flex flex-col items-center gap-1 active:scale-95 transition-all"
                        >
                          <div className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedStyle?.id === ref.id ? "border-primary shadow-md shadow-primary/20 scale-105" : "border-transparent"}`}>
                            <BeautyImage src={ref.img} alt={ref.label} className="w-full h-full object-cover" />
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
                        onClick={() => setVisibleCount(c => c + 12)}
                        className="w-full mt-3 py-3.5 rounded-2xl border-2 border-primary/30 bg-primary/5 text-primary font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Voir plus ({filteredStyles.length - visibleCount} restants)
                      </button>
                    )}
                  </>
                )}
              </div>

              {selectedStyle && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex items-center gap-3">
                  <BeautyImage src={selectedStyle.img} alt={selectedStyle.label} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-gray-900">Style sélectionné : {selectedStyle.label}</p>
                    {selectedStyle.author && (
                      <p className="text-[10px] text-primary font-bold">✦ Publié par {selectedStyle.author}</p>
                    )}
                    <p className="text-[11px] text-gray-500">OpenAI IA va générer votre photo avec ce style</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 rounded-2xl p-3 flex items-start gap-2 border border-blue-100">
                <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  <strong>Vie privée garantie</strong> — Vos photos sont traitées de façon sécurisée par OpenAI AI et ne sont pas stockées.
                </p>
              </div>

              <button
                onClick={startSimulation}
                disabled={!userPhoto || !selectedStyle}
                className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 transition-all ${
                  userPhoto && selectedStyle
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Sparkles className="w-4 h-4" strokeWidth={1.5} /> GÉNÉRER MA COIFFURE
              </button>
            </div>
          )}

          {/* ── STEP 3: Loading ── */}
          {step === 3 && (
            <div className="relative -mx-5 -my-4 flex flex-col items-center justify-center min-h-[70vh] overflow-hidden">
              {/* Blurred background with user photo */}
              {userPhotoUrl ? (
                <div className="absolute inset-0">
                  <BeautyImage src={userPhotoUrl} alt="" className="w-full h-full object-cover scale-110 blur-sm" />
                  <div className="absolute inset-0 bg-black/40" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
              )}

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center w-full px-8">
                {/* Scissors icon */}
                <div className="w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/50 flex items-center justify-center mb-8">
                  <Scissors className="w-8 h-8 text-primary" />
                </div>

                {/* Title + percentage */}
                <div className="w-full flex items-center justify-between mb-3">
                  <p className="text-white text-[18px] font-black drop-shadow-lg">{progressMsg}</p>
                  <p className="text-primary text-[22px] font-black drop-shadow-lg">En cours</p>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-white/15 rounded-full overflow-hidden border border-white/10 mb-4">
                  <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none text-primary mb-4" aria-label="Traitement en cours"/>
                </div>

                {/* Subtitle */}
                <p className="text-white/60 text-[13px] font-medium text-center mb-6">
                  Simulation IA en cours — patientez...
                </p>

                {/* Cancel */}
                <button
                  onClick={onClose}
                  className="text-white/50 text-[13px] font-medium underline underline-offset-2 active:scale-95 transition-all"
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
                    {result.fallback ? "Généré par IA (mode fallback)" : "Généré par OpenAI AI"}
                  </span>
                </div>
              </div>
              {result.fallback && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-purple-700 font-medium">{result.fallbackMessage || "Image générée par IA — crédits fal.ai épuisés"}</p>
                </div>
              )}

              {result.error ? (
                // Erreur — afficher un message clair
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                  <p className="text-[14px] font-black text-red-600 mb-2">⚠️ Génération échouée</p>
                  <p className="text-[12px] text-gray-600">{result.error}</p>
                  <p className="text-[11px] text-gray-500 mt-2">Rechargez votre solde sur <a href="https://fal.ai/dashboard/billing" target="_blank" className="text-primary underline">fal.ai/dashboard/billing</a> ou réessayez plus tard.</p>
                </div>
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
                    {/* APRÈS — image générée par OpenAI */}
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
                    <p className="text-[11px] text-gray-400 font-medium">Image générée par OpenAI AI</p>
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