 import { useEffect, useMemo, useRef, useState } from "react";
 import { Check, FileVideo, Lightbulb, Loader2, Search, Upload, Video } from "lucide-react";
 import { entities, uploadFile } from "@/api/entities";

 const CONFIG_KEY = "style_conseils";

 const rowsFrom = (result) => {
   if (Array.isArray(result)) return result;
   return result?.data?.results || result?.data || [];
 };

 const isConseil = (reel) => {
   const category = String(reel?.category || "").trim().toLowerCase();
   const pubType = String(reel?.pub_type || "").trim().toLowerCase();
   return category === "conseil" || category === "conseils" || pubType === "conseil";
 };

 const normaliseText = (value) => String(value || "").trim().toLowerCase();

 const normaliseMapping = (value) => {
   const next = {};
   const claimed = new Set();
   Object.entries(value && typeof value === "object" ? value : {}).forEach(([styleId, ids]) => {
     next[String(styleId)] = (Array.isArray(ids) ? ids : [])
       .map(item => String(item?.id || item))
       .filter(id => id && !claimed.has(id));
     next[String(styleId)].forEach(id => claimed.add(id));
   });
   return next;
 };

 export default function AdminStyleConseils({ styles = [] }) {
   const [reels, setReels] = useState([]);
   const [mapping, setMapping] = useState({});
   const [configRow, setConfigRow] = useState(null);
   const [selectedStyleId, setSelectedStyleId] = useState("");
   const [selectedReelIds, setSelectedReelIds] = useState([]);
   const [search, setSearch] = useState("");
   const [styleSearch, setStyleSearch] = useState("");
   const [title, setTitle] = useState("");
   const [previewMedia, setPreviewMedia] = useState(null);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [uploading, setUploading] = useState(false);
   const [error, setError] = useState("");
   const videoInputRef = useRef(null);

   const availableStyles = useMemo(
     () => styles.filter(style => normaliseText(style.status) !== "supprime"),
     [styles]
   );

   const visibleStyles = useMemo(() => {
     const query = normaliseText(styleSearch);
     if (!query) return availableStyles;
     return availableStyles.filter(style =>
       normaliseText(style.title).includes(query) ||
       normaliseText(style.category).includes(query)
     );
   }, [availableStyles, styleSearch]);

   const visibleReels = useMemo(() => {
     const query = normaliseText(search);
     const ownerByReel = new Map(
       Object.entries(mapping).flatMap(([styleId, ids]) =>
         (Array.isArray(ids) ? ids : []).map(id => [String(id?.id || id), String(styleId)])
       )
     );
     return reels.filter(reel => {
       const ownerStyleId = ownerByReel.get(String(reel.id));
       if (ownerStyleId && ownerStyleId !== String(selectedStyleId)) return false;
       if (!query) return true;
       return [
         reel.title,
         reel.description,
         reel.author_name,
         reel.category,
       ].some(value => normaliseText(value).includes(query));
     });
   }, [mapping, reels, search, selectedStyleId]);

   useEffect(() => {
     if (!selectedStyleId && availableStyles[0]?.id) {
       setSelectedStyleId(String(availableStyles[0].id));
     }
   }, [availableStyles, selectedStyleId]);

   useEffect(() => {
     const ids = mapping[String(selectedStyleId)] || [];
     setSelectedReelIds(ids.map(String));
   }, [mapping, selectedStyleId]);

   useEffect(() => {
     let cancelled = false;
     setLoading(true);
     Promise.all([
       entities.Reel.list("-created_at", 500),
       entities.AppConfig.filter({ key: CONFIG_KEY }, "-created_at", 1),
     ]).then(([reelResult, configResult]) => {
       if (cancelled) return;
       const rows = rowsFrom(reelResult).filter(reel => normaliseText(reel.status) === "publie" && isConseil(reel));
       const config = rowsFrom(configResult)[0] || null;
       const stored = config?.value?.styles || {};
       setReels(rows);
       setConfigRow(config);
       setMapping(normaliseMapping(stored));
     }).catch(err => {
       if (!cancelled) setError(err.message || "Impossible de charger les conseils.");
     }).finally(() => {
       if (!cancelled) setLoading(false);
     });
     return () => { cancelled = true; };
   }, []);

   const persistSelection = async (styleId, ids) => {
     if (!styleId) return;
     const currentStyleId = String(styleId);
     const claimedByOtherStyle = new Set(
       Object.entries(mapping)
         .filter(([mappedStyleId]) => String(mappedStyleId) !== currentStyleId)
         .flatMap(([, mappedIds]) => (Array.isArray(mappedIds) ? mappedIds : []).map(id => String(id?.id || id)))
     );
     const uniqueIds = [...new Set(ids.map(String))].filter(id => !claimedByOtherStyle.has(id));
     const nextMapping = { ...mapping, [currentStyleId]: uniqueIds };
     setSaving(true);
     setError("");
     try {
       const payload = { key: CONFIG_KEY, value: { styles: nextMapping } };
       const saved = configRow
         ? await entities.AppConfig.update(configRow.id, payload)
         : await entities.AppConfig.create(payload);
       setConfigRow(saved || configRow || payload);
       setMapping(nextMapping);
       setSelectedReelIds(ids.map(String));
     } catch (err) {
       setError(err.message || "Impossible d'enregistrer les conseils.");
     } finally {
       setSaving(false);
     }
   };

   const toggleReel = (reelId) => {
     const id = String(reelId);
     const ownerStyleId = Object.entries(mapping).find(([, ids]) =>
       (Array.isArray(ids) ? ids : []).some(item => String(item?.id || item) === id)
     )?.[0];
     if (ownerStyleId && String(ownerStyleId) !== String(selectedStyleId)) return;
     const nextIds = selectedReelIds.includes(id)
       ? selectedReelIds.filter(item => item !== id)
       : [...selectedReelIds, id];
     setSelectedReelIds(nextIds);
   };

   const saveSelection = () => persistSelection(selectedStyleId, selectedReelIds);

   const importVideo = async (event) => {
     const file = event.target.files?.[0];
     event.target.value = "";
     if (!file) return;
     if (!selectedStyleId) {
       setError("Sélectionnez d'abord un style.");
       return;
     }
     if (!file.type.startsWith("video/")) {
       setError("Sélectionnez un fichier vidéo.");
       return;
     }

     setUploading(true);
     setError("");
     try {
       const { file_url } = await uploadFile({ file });
       const createdResult = await entities.Reel.create({
         title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
         description: "Conseil beauté",
         images: [],
         video_url: file_url,
         thumbnail_url: "",
         author_email: "admin@beautybook.fr",
         author_name: "BeautyBook",
         category: "Conseils",
         status: "publie",
       });
       const created = createdResult?.data?.reel || createdResult?.result || createdResult;
       if (!created?.id) throw new Error("La vidéo n'a pas pu être publiée.");
       setReels(previous => [created, ...previous]);
       setPreviewMedia({ type: "video", url: file_url, title: created.title || title || file.name });
       const nextIds = [...new Set([...selectedReelIds, String(created.id)])];
       await persistSelection(selectedStyleId, nextIds);
       setTitle("");
     } catch (err) {
       setError(err.message || "Impossible d'importer la vidéo.");
     } finally {
       setUploading(false);
     }
   };

   return (
     <div className="space-y-4">
       <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
         <div className="flex items-start gap-3">
           <div className="w-10 h-10 rounded-xl bg-orange-50 text-primary flex items-center justify-center shrink-0">
             <Lightbulb className="w-5 h-5" />
           </div>
           <div>
             <h3 className="text-gray-900 text-[15px] font-black">Conseils liés aux styles</h3>
             <p className="text-gray-500 text-[12px] mt-1">
               Associez des publications de l'onglet Conseil à une fiche style. Elles apparaîtront uniquement sur cette fiche.
             </p>
           </div>
         </div>
       </div>

       {error && <p className="text-red-600 text-[12px] bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

       {availableStyles.length === 0 ? (
         <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500 text-[13px]">
           Créez d'abord un style publié pour lui ajouter des conseils.
         </div>
       ) : (
         <>
           <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
             <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest">1. Choisir le style</p>
             <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
               <Search className="w-4 h-4 text-gray-400 shrink-0" />
               <input
                 value={styleSearch}
                 onChange={event => setStyleSearch(event.target.value)}
                 placeholder="Rechercher un style..."
                 className="flex-1 bg-transparent text-gray-700 text-[13px] outline-none"
               />
             </div>
             <div className="flex gap-2 overflow-x-auto pb-1">
               {visibleStyles.map(style => {
                 const active = String(style.id) === String(selectedStyleId);
                 const count = (mapping[String(style.id)] || []).length;
                 return (
                   <button
                     key={style.id}
                     type="button"
                     onClick={() => setSelectedStyleId(String(style.id))}
                     className={`shrink-0 text-left rounded-xl border px-3 py-2.5 min-w-[150px] transition-all ${active ? "border-primary bg-orange-50" : "border-gray-200 bg-white"}`}
                   >
                     <p className="text-[12px] font-black text-gray-900 truncate">{style.title}</p>
                     <p className="text-[10px] text-gray-500 mt-0.5">{style.category || "Style"} · {count} conseil(s)</p>
                   </button>
                 );
               })}
             </div>
           </div>

           <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest">2. Ajouter une vidéo Conseil</p>
                 <p className="text-gray-400 text-[11px] mt-1">La vidéo sera publiée dans Réseau social → Conseils et liée au style choisi.</p>
               </div>
               <Video className="w-5 h-5 text-primary shrink-0" />
             </div>
             <div className="flex flex-col sm:flex-row gap-2">
               <input
                 value={title}
                 onChange={event => setTitle(event.target.value)}
                 placeholder="Titre de la vidéo (optionnel)"
                 className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-3 py-2.5 text-[13px] outline-none"
               />
               <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={importVideo} />
               <button
                 type="button"
                 disabled={uploading}
                 onClick={() => videoInputRef.current?.click()}
                 className="flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-2.5 text-[12px] font-black disabled:opacity-60"
               >
                 {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                 {uploading ? "Import..." : "Importer la vidéo"}
               </button>
             </div>
           </div>

           <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <p className="text-gray-600 text-[11px] font-black uppercase tracking-widest">3. Sélectionner des publications Conseil</p>
                 <p className="text-gray-500 text-[12px] mt-1">{selectedReelIds.length} publication(s) liée(s) au style sélectionné</p>
               </div>
               <button
                 type="button"
                 onClick={saveSelection}
                 disabled={saving || loading}
                 className="bg-gray-900 text-white rounded-xl px-4 py-2 text-[12px] font-black disabled:opacity-50"
               >
                 {saving ? "Enregistrement..." : "Enregistrer"}
               </button>
             </div>
             <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
               <Search className="w-4 h-4 text-gray-400 shrink-0" />
               <input
                 value={search}
                 onChange={event => setSearch(event.target.value)}
                 placeholder="Rechercher une publication, un auteur..."
                 className="flex-1 bg-transparent text-gray-700 text-[13px] outline-none"
               />
             </div>
             {loading ? (
               <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
             ) : visibleReels.length === 0 ? (
               <div className="flex flex-col items-center gap-2 py-8 text-gray-400 text-[13px]">
                 <FileVideo className="w-8 h-8" />
                 <span>Aucune publication Conseil publiée.</span>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                 {visibleReels.map(reel => {
                   const selected = selectedReelIds.includes(String(reel.id));
                   const thumb = reel.thumbnail_url || reel.image_url || reel.images?.[0];
                   const preview = () => setPreviewMedia({
                     type: reel.video_url ? "video" : "image",
                     url: reel.video_url || thumb,
                     title: reel.title || "Publication Conseil",
                   });
                   return (
                     <div
                       key={reel.id}
                       onClick={() => toggleReel(reel.id)}
                       role="button"
                       tabIndex={0}
                       onKeyDown={event => { if (event.key === "Enter" || event.key === " ") toggleReel(reel.id); }}
                       className={`flex items-center gap-3 text-left rounded-xl border p-2.5 transition-all ${selected ? "border-primary bg-orange-50" : "border-gray-200 bg-white"}`}
                     >
                       <button type="button" onClick={event => { event.stopPropagation(); preview(); }} className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-900 shrink-0 flex items-center justify-center cursor-zoom-in" aria-label={`Prévisualiser ${reel.title || "la publication"}`}>
                         {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : reel.video_url ? <Video className="w-5 h-5 text-white" /> : <FileVideo className="w-5 h-5 text-gray-400" />}
                         {reel.video_url && <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Video className="w-4 h-4 text-white" /></span>}
                       </button>
                       <div className="flex-1 min-w-0">
                         <p className="text-[12px] font-black text-gray-900 truncate">{reel.title || "Publication sans titre"}</p>
                         <p className="text-[10px] text-gray-500 truncate">{reel.author_name || "Auteur inconnu"} · {reel.pub_type || reel.category}</p>
                       </div>
                       <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${selected ? "bg-primary text-white" : "bg-gray-100 text-gray-400"}`}>
                         <Check className="w-3.5 h-3.5" />
                       </span>
                     </div>
                   );
                 })}
               </div>
             )}
           </div>
         </>
       )}
      {previewMedia && (
        <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-5" onClick={() => setPreviewMedia(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setPreviewMedia(null)} className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-lg" aria-label="Fermer l'aperçu">×</button>
            {previewMedia.type === "video" ? (
              <video src={previewMedia.url} controls autoPlay playsInline className="max-h-[85vh] max-w-full rounded-2xl bg-black" />
            ) : (
              <img src={previewMedia.url} alt={previewMedia.title} className="max-h-[85vh] max-w-full object-contain rounded-2xl" />
            )}
          </div>
        </div>
      )}
     </div>
   );
 }
