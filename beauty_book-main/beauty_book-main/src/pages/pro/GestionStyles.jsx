import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Camera, Video, X, Upload, Edit3 } from "lucide-react";
import { uploadFile, entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";

const CATEGORIES = ["Coiffure", "Maquillage", "Ongles", "Soin", "Barbe", "Massage"];

function StyleForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    title: "",
    description: "",
    category: "Coiffure",
    image_url: "",
    images: [],
    video_url: "",
    tags: [],
    status: "publie",
    featured: false,
  });
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState(null);
  const imgRef = useRef(null);
  const videoRef = useRef(null);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const urls = [];
    try {
      for (const file of files) {
        const { file_url } = await uploadFile({ file });
        urls.push(file_url);
      }
      const firstUrl = urls[0];
      setForm(f => ({
        ...f,
        image_url: f.image_url || firstUrl,
        images: [...(f.images || []), ...urls],
      }));
    } catch (err) {
      setError("Erreur upload image: " + err.message);
    }
    setUploading(false);
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await uploadFile({ file });
      setForm(f => ({ ...f, video_url: file_url }));
    } catch (err) {
      setError("Erreur upload vidéo: " + err.message);
    }
    setUploading(false);
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }));
    setTagInput("");
  };

  const isValid = form.title && (form.image_url || (form.images && form.images.length > 0));

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col font-display overflow-y-auto">
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />

      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
        <button onClick={onCancel} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          <X className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-[16px] font-black text-gray-900">{initial ? "Modifier le style" : "Nouveau style"}</h2>
        <button
          onClick={() => isValid && onSave(form)}
          disabled={!isValid || uploading}
          className="px-5 py-2.5 rounded-full font-black text-[13px] uppercase tracking-widest text-white transition-all active:scale-95"
          style={{ background: isValid && !uploading ? "#E8732A" : "#d1d5db" }}
        >
          {uploading ? "..." : "Publier"}
        </button>
      </div>

      <div className="px-5 pt-5 pb-10 space-y-5">
        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-red-600 text-[12px] font-medium">❌ {error}</p>
          </div>
        )}

        {/* Médias */}
        <div>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">Photo principale & Vidéo</p>
          <div className="flex gap-3 flex-wrap">
            {form.image_url ? (
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                <BeautyImage src={form.image_url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setForm(f => ({ ...f, image_url: "", images: [] }))} className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
                <span className="absolute bottom-1 left-1 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">COVER</span>
              </div>
            ) : (
              <button onClick={() => imgRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 active:scale-95 bg-gray-50">
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-[9px] font-black text-gray-400 uppercase">Photo</span>
              </button>
            )}

            {form.video_url ? (
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-800 shrink-0">
                <video src={form.video_url} className="w-full h-full object-cover" />
                <button onClick={() => setForm(f => ({ ...f, video_url: "" }))} className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
                <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">VID</span>
              </div>
            ) : (
              <button onClick={() => videoRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-blue-200 flex flex-col items-center justify-center gap-1.5 active:scale-95 bg-blue-50">
                <Video className="w-6 h-6 text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 uppercase">Vidéo</span>
              </button>
            )}
          </div>
          {uploading && (
            <p className="text-[12px] text-primary font-bold mt-2 flex items-center gap-2">
              <Upload className="w-4 h-4 animate-bounce" /> Upload en cours...
            </p>
          )}
        </div>

        {/* Titre */}
        <div>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Titre *</p>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Ex: Balayage Doré Californien"
            className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Description</p>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Décrivez ce style, la technique utilisée..."
            rows={3}
            className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-[14px] font-medium text-gray-800 outline-none resize-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Catégorie */}
        <div>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Catégorie</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                className={`px-4 py-2 rounded-full text-[12px] font-black border-2 transition-all active:scale-95 ${form.category === c ? "bg-primary border-primary text-white" : "border-gray-200 text-gray-600 bg-white"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Tags</p>
          <div className="flex gap-2 mb-2 flex-wrap">
            {(form.tags || []).map((tag, i) => (
              <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[12px] font-bold">
                #{tag}
                <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, ti) => ti !== i) }))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTag()}
              placeholder="balayage, tendance..."
              className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-[13px] font-medium outline-none"
            />
            <button onClick={addTag} className="px-4 py-3 bg-primary rounded-2xl text-white font-black text-[13px] active:scale-95">Ajouter</button>
          </div>
        </div>

        {/* Statut */}
        <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
          <div>
            <p className="text-[14px] font-black text-gray-900">Publié</p>
            <p className="text-[11px] text-gray-400 font-medium">Visible dans l'application</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, status: f.status === "publie" ? "brouillon" : "publie" }))}
            className={`w-12 h-6 rounded-full transition-all ${form.status === "publie" ? "bg-primary" : "bg-gray-300"}`}
          >
            <div className="w-5 h-5 bg-white rounded-full shadow" style={{ transform: form.status === "publie" ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>

        {/* Mis en avant */}
        <div className="flex items-center justify-between bg-orange-50 rounded-2xl p-4 border border-orange-100">
          <div>
            <p className="text-[14px] font-black text-gray-900">⭐ Mis en avant</p>
            <p className="text-[11px] text-gray-400 font-medium">Apparaît en tête de liste</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
            className={`w-12 h-6 rounded-full transition-all ${form.featured ? "bg-primary" : "bg-gray-300"}`}
          >
            <div className="w-5 h-5 bg-white rounded-full shadow" style={{ transform: form.featured ? "translateX(26px)" : "translateX(2px)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GestionStyles() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cacheKey = user?.email ? `styles_${user.email}` : null;
  // Affichage direct depuis le cache : pas d'écran « chargement » intermédiaire,
  // le rafraîchissement réseau se fait en arrière-plan sans vider l'affichage.
  const [styles, setStyles] = useCachedState(cacheKey, [], (c) => c?.styles || []);
  const [loading, setLoading] = useState(() => !readPageCache(cacheKey));
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    loadStyles();
  }, [user]);

  const loadStyles = async () => {
    setGlobalError(null);
    try {
      const userEmail = user?.email;
      let data = [];
      if (userEmail) {
        // Essayer par pro_email d'abord
        data = await entities.Style.filter({ pro_email: userEmail }, "-created_at", 200);
        // Si vide, essayer par author_email
        if (!data || data.length === 0) {
          data = await entities.Style.filter({ author_email: userEmail }, "-created_at", 200);
        }
      } else {
        data = await entities.Style.list("-created_at", 200);
      }
      const list = data || [];
      setStyles(list);
      mergePageCache(cacheKey, { styles: list });
    } catch (e) {
      setGlobalError("Erreur de chargement: " + e.message);
    }
    setLoading(false);
  };

  const handleSave = async (form) => {
    setGlobalError(null);
    try {
      if (editing) {
        await entities.Style.update(editing.id, {
          title: form.title,
          description: form.description,
          category: form.category,
          image_url: form.image_url,
          images: form.images,
          video_url: form.video_url,
          tags: form.tags,
          status: form.status,
          featured: form.featured,
        });
      } else {
        await entities.Style.create({
          title: form.title,
          description: form.description,
          category: form.category,
          image_url: form.image_url,
          images: form.images,
          video_url: form.video_url || undefined,
          tags: form.tags,
          status: form.status,
          featured: form.featured,
          pro_email: user?.email || "",
          author_email: user?.email || "",
          author_name: user?.full_name || "Professionnel",
          author_avatar: user?.avatar_url || "",
          likes: 0,
          views: 0,
        });
      }
      setShowForm(false);
      setEditing(null);
      await loadStyles();
    } catch (e) {
      setGlobalError("Erreur de sauvegarde: " + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce style ?")) return;
    try {
      await entities.Style.delete(id);
      setStyles(s => s.filter(x => x.id !== id));
    } catch (e) {
      setGlobalError("Erreur de suppression: " + e.message);
    }
  };

  const handleEdit = (style) => {
    setEditing(style);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <StyleForm
        initial={editing}
        onSave={handleSave}
        onCancel={() => { setShowForm(false); setEditing(null); }}
      />
    );
  }

  return (
    <div className="font-display min-h-full bg-gray-50">
      <div className="bg-white px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="text-center">
          <h1 className="text-[15px] font-black text-gray-900">Mes Styles</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gérez votre portfolio</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {globalError && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <p className="text-red-600 text-[12px] font-medium">❌ {globalError}</p>
        </div>
      )}

      {/* Gate : aucun spinner si des styles en cache sont déjà affichés. */}
      {loading && styles.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : styles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 px-8 text-center">
          <Camera className="w-16 h-16 text-gray-200" />
          <p className="text-[16px] font-black text-gray-700">Aucun style publié</p>
          <p className="text-[13px] text-gray-400 font-medium">Créez votre premier style pour le montrer à vos clients.</p>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-primary text-white font-black text-[13px] uppercase tracking-widest px-6 py-3.5 rounded-2xl shadow-md shadow-primary/30 active:scale-95"
          >
            Créer un style
          </button>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-3">
          {styles.map(style => (
            <div key={style.id} className="bg-white rounded-3xl overflow-hidden shadow-sm">
              <div className="relative aspect-square bg-gray-100">
                {style.image_url || (style.images && style.images[0]) ? (
                  <BeautyImage src={style.image_url || style.images[0]} alt={style.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                {style.images && style.images.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5">
                    <span className="text-white text-[9px] font-black">{style.images.length} 📷</span>
                  </div>
                )}
                {style.video_url && (
                  <div className="absolute top-2 left-2 bg-blue-500 rounded-full px-2 py-0.5">
                    <span className="text-white text-[9px] font-black">▶ VID</span>
                  </div>
                )}
                <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${style.status === "publie" ? "bg-green-500 text-white" : "bg-gray-400 text-white"}`}>
                  {style.status === "publie" ? "Publié" : "Brouillon"}
                </span>
              </div>
              <div className="p-3">
                <p className="text-[13px] font-black text-gray-900 truncate">{style.title}</p>
                <p className="text-[11px] text-primary font-bold uppercase tracking-widest">{style.category}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <button onClick={() => handleEdit(style)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 rounded-xl active:scale-95 transition-all">
                    <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-[11px] font-black text-gray-600">Éditer</span>
                  </button>
                  <button onClick={() => handleDelete(style.id)} className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}