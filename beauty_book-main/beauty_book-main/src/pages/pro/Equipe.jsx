import BeautyImage from '@/components/ui/BeautyImage';
import { useState, useEffect } from "react";
import { useCachedState, readPageCache, mergePageCache } from "@/hooks/usePageCache";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Calendar, User, Loader2, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from "@/lib/AuthContext";

const STATUS_CONFIG = {
  available: { color: "bg-teal-100 text-teal-600", dot: "bg-green-400", label: "Disponible" },
  pause: { color: "bg-orange-50 text-orange-400", dot: "bg-orange-400", label: "En Pause" },
  absent: { color: "bg-red-50 text-red-400", dot: "bg-red-400", label: "Absent" },
};

export default function Equipe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Cache par pro : affichage direct des derniers membres, refresh en arrière-plan.
  const eqKey = user?.email ? `equipe_${user.email}` : null;
  const [members, setMembers] = useCachedState(eqKey, [], c => c?.members || []);
  const [loading, setLoading] = useState(() => !readPageCache(eqKey)?.members?.length);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const load = () => {
    if (!user?.email) return;
    setLoading(true);
    entities.MembreEquipe.filter({ pro_email: user.email }, "-created_at", 50)
      .then(data => { setMembers(data || []); mergePageCache(eqKey, { members: data || [] }); })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (id) => {
    await entities.MembreEquipe.delete(id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleStatusChange = async (member) => {
    const cycle = { available: "pause", pause: "absent", absent: "available" };
    const newStatus = cycle[member.status] || "available";
    await entities.MembreEquipe.update(member.id, { status: newStatus });
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: newStatus } : m));
  };

  const filtered = members.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.role?.toLowerCase().includes(search.toLowerCase())
  );

  const available = members.filter(m => m.status === "available").length;

  return (
    <div className="font-display min-h-full bg-[#f0f0f0]">
      <PageHeader title="Mon Équipe" subtitle="Administration" dark={false} />

      {/* Stats Row */}
      <div className="mx-5 -mt-5 z-10 relative flex gap-3">
        <div className="flex-1 bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-primary text-[16px]">👥</span>
            </div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Effectif Total</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-black text-gray-900 leading-none">{members.length}</span>
            <span className="text-[11px] font-black text-green-500">{available} DISPO</span>
          </div>
        </div>
        <div className="bg-[#1a2035] rounded-3xl p-4 shadow-sm flex flex-col justify-between min-w-[110px]">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-white text-[14px]">↗</span>
          </div>
          <div>
            <p className="text-[28px] font-black text-white leading-none">
              {members.length > 0 ? Math.round((available / members.length) * 100) : 0}%
            </p>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Disponibles</p>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="px-5 pt-5 pb-24">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-[26px] font-black text-gray-900 leading-tight">Membres du<br />Studio</h2>
            <p className="text-[12px] text-gray-400 font-medium">{members.length} membre{members.length > 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowSearch(s => !s)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <Search className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {showSearch && (
          <div className="mt-3 mb-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre..."
              className="w-full bg-white rounded-2xl px-4 py-3 text-[13px] outline-none shadow-sm"
            />
          </div>
        )}

        {(loading && members.length === 0) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">👥</span>
            <p className="text-[15px] font-black text-gray-400">Aucun membre</p>
            <p className="text-[12px] text-gray-300 font-medium text-center">Ajoutez votre premier membre d'équipe</p>
            <button
              onClick={() => navigate("/pro/nouveau-membre")}
              className="mt-2 bg-primary text-white px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest"
            >
              + Ajouter un membre
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {filtered.map(member => {
              const sc = STATUS_CONFIG[member.status] || STATUS_CONFIG.available;
              const initials = (member.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={member.id} className="bg-white rounded-3xl p-5 shadow-sm">
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="relative mb-3">
                      {(member.membre_avatar || member.avatar_url) ? (
                        <BeautyImage src={member.membre_avatar || member.avatar_url} alt={member.name} className="w-24 h-24 rounded-full object-cover border-2 border-gray-100" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-gray-100 flex items-center justify-center">
                          <span className="text-primary text-[28px] font-black">{initials}</span>
                        </div>
                      )}
                      <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white ${sc.dot}`} />
                    </div>
                    <h3 className="text-[20px] font-black text-gray-900 leading-tight">{member.name}</h3>
                    <p className="text-[11px] font-black text-primary uppercase tracking-widest mt-0.5">{member.role}</p>
                    {(member.experience > 0 || Number(member.experience) > 0) && (
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{member.experience} ans d'expérience</p>
                    )}
                  </div>

                  {/* Specialties */}
                  {(member.specialites || member.specialties)?.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      {(member.specialites || member.specialties).map(s => (
                        <span key={s} className="px-3 py-1.5 bg-gray-100 rounded-full text-[10px] font-black text-gray-600 uppercase tracking-widest">{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Status — cliquable pour changer */}
                  <button
                    onClick={() => handleStatusChange(member)}
                    className={`w-full py-3 rounded-2xl ${sc.color} text-center text-[12px] font-black uppercase tracking-widest mb-4 active:scale-95 transition-all`}
                  >
                    {sc.label} · appuyer pour changer
                  </button>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="py-3 bg-red-50 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">Retirer</span>
                    </button>
                    <button
                      onClick={() => navigate(`/pro/planning-membre?id=${member.id}&name=${encodeURIComponent(member.name)}`)}
                      className="py-3 bg-primary rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-primary/30"
                    >
                      <Calendar className="w-5 h-5 text-white" />
                      <span className="text-[11px] font-black text-white uppercase tracking-widest">Planning</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/pro/nouveau-membre")}
        className="fixed bottom-24 right-5 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/40 active:scale-95 transition-all z-50"
      >
        <Plus className="w-7 h-7 text-white" />
      </button>
    </div>
  );
}