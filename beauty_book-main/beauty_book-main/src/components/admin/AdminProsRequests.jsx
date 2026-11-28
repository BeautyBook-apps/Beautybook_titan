import { deleteAccountCompletely } from "@/lib/adminUserManagement";
import { useState, useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { Search, CheckCircle, XCircle, Trash2, FileText, ChevronRight, X, ExternalLink, AlertTriangle } from "lucide-react";

const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';

const FILTERS = ["Tous", "En attente", "Approuvés", "Refusés"];

const STATUS_CONFIG = {
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-600" },
  approuvee: { label: "Approuvé ✓", cls: "bg-green-100 text-green-600" },
  refusee: { label: "Refusé", cls: "bg-red-100 text-red-500" },
};

function DocLink({ url, label }) {
  if (!url) return <span className="text-gray-300 text-[11px]">—</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-primary text-[11px] font-black underline">
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );
}

function ProDetailPanel({ demande, onClose, onAction, loading }) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-3xl lg:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            {demande.salon_photo ? (
              <img src={demande.salon_photo} alt={demande.salon_name} className="w-11 h-11 rounded-xl object-cover" />
            ) : (
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
                <span className="text-primary font-black text-[16px]">{demande.salon_name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-gray-900 text-[15px] font-black">{demande.salon_name}</p>
              <p className="text-gray-400 text-[11px]">{demande.user_email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Type d'activité</p>
            <p className="text-[14px] font-black text-gray-900">{demande.type_activite || "Non renseigné"}</p>
          </div>
          {demande.salon_name && <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nom du salon</p><p className="text-[14px] font-black text-gray-900">{demande.salon_name}</p></div>}
          {demande.bio && <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Bio</p><p className="text-[13px] text-gray-700">{demande.bio}</p></div>}
          {demande.specialites?.length > 0 && <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Spécialités</p><div className="flex flex-wrap gap-1.5">{demande.specialites.map(s => <span key={s} className="bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-1 rounded-full">{s}</span>)}</div></div>}

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Documents</p>
            <div className="grid grid-cols-2 gap-2">
              {demande.doc_identite_recto && <DocLink url={demande.doc_identite_recto} label="ID Recto" />}
              {demande.doc_identite_verso && <DocLink url={demande.doc_identite_verso} label="ID Verso" />}
              {demande.doc_siret && <DocLink url={demande.doc_siret} label="SIRET" />}
              {demande.doc_assurance && <DocLink url={demande.doc_assurance} label="Assurance" />}
            </div>
          </div>

          {note && <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><p className="text-[11px] text-amber-600 font-medium">{note}</p></div>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => onAction(demande.id, "approuvee")} disabled={loading}
              className="flex-1 py-3 rounded-xl bg-green-500 text-white font-black text-[13px] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Approuver
            </button>
            <button onClick={() => onAction(demande.id, "refusee", note)} disabled={loading}
              className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black text-[13px] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" /> Refuser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminProsRequests() {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [selected, setSelected] = useState(null);

  const fetchDemandes = async () => {
    try {
      const { data } = await supabase.from('DemandeProV2').select('*').order('created_at', { ascending: false });
      setDemandes(data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDemandes(); }, []);

  const handleAction = async (id, statut, note = "") => {
    setActionLoading(true);
    try {
      await supabase.from('DemandeProV2').update({ statut, admin_notes: note, updated_at: new Date().toISOString() }).eq('id', id);
      setDemandes(prev => prev.map(d => d.id === id ? { ...d, statut, admin_notes: note } : d));

      // Si approuvé, créer ou mettre à jour le profil pro avec la clé service_role
      if (statut === "approuvee") {
        const demande = demandes.find(d => d.id === id);
        if (demande) {
          try {
            const payload = {
              user_email: demande.user_email,
              salon_name: demande.salon_name || "Mon Salon",
              bio: demande.bio || "",
              specialites: demande.specialites || [],
              address: demande.address || "",
              city: demande.city || "",
              phone: demande.phone || "",
              status: "actif",
              latitude: demande.latitude || null,
              longitude: demande.longitude || null,
            };
            // Check if ProfilPro already exists for this email
            const { data: existing } = await supabase.from('ProfilPro').select('id').eq('user_email', demande.user_email).maybeSingle();
            if (existing?.id) {
              // Update existing record
              await fetch(`${SUPABASE_URL}/rest/v1/ProfilPro?id=eq.${existing.id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify(payload),
              });
            } else {
              // Insert new record
              await fetch(`${SUPABASE_URL}/rest/v1/ProfilPro`, {
                method: 'POST',
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify(payload),
              });
            }
          } catch (e) {
            console.error('[Admin] Upsert ProfilPro error:', e);
          }
        }
      }

      setSelected(null);
    } catch {}
    setActionLoading(false);
  };

  const filtered = demandes.filter(d => {
    const matchSearch = !search || d.salon_name?.toLowerCase().includes(search.toLowerCase()) || d.user_email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "Tous"
      || (filter === "En attente" && d.statut === "en_attente")
      || (filter === "Approuvés" && d.statut === "approuvee")
      || (filter === "Refusés" && d.statut === "refusee");
    return matchSearch && matchFilter;
  });

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent text-gray-700 text-[13px] outline-none placeholder:text-gray-400" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>{f}</button>
        ))}
      </div>

      <p className="text-gray-500 text-[12px]">{filtered.length} demande(s)</p>
      <div className="space-y-3">
        {filtered.map(d => {
          const st = STATUS_CONFIG[d.statut] || STATUS_CONFIG.en_attente;
          return (
            <div key={d.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 shadow-sm cursor-pointer active:scale-[0.99] transition-all" onClick={() => setSelected(d)}>
              {d.salon_photo ? (
                <img src={d.salon_photo} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-primary font-black text-[16px]">{d.salon_name?.[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[14px] font-black truncate">{d.salon_name || "Sans nom"}</p>
                <p className="text-gray-500 text-[11px] truncate">{d.user_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-gray-400 text-center py-10 text-[13px]">Aucune demande trouvée.</p>}
      </div>

      {selected && <ProDetailPanel demande={selected} onClose={() => setSelected(null)} onAction={handleAction} loading={actionLoading} />}
    </div>
  );
}
