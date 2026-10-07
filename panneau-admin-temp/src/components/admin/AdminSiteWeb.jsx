import { useState, useEffect, useRef, useCallback } from "react";
import {
  Globe, Download, Copy, Eye, Loader2, Check, Building2,
  Star, MapPin, Phone, Instagram, Facebook, RefreshCw, ChevronRight
} from "lucide-react";
import { entities } from "@/api/entities/index.js";
import { generateProWebsite } from "@/lib/generateProWebsite";

// ── helpers ──────────────────────────────────────────────────────────────────
const safeList = async (entity, order = "-created_at", limit = 500) => {
  try {
    return (await entity.list(order, limit)) || [];
  } catch {
    return [];
  }
};

const safeFilter = async (entity, filters, order = "-created_at", limit = 500) => {
  try {
    return (await entity.filter(filters, order, limit)) || [];
  } catch {
    return [];
  }
};

const firstImage = (pro) =>
  pro?.avatar_url || pro?.cover_url || "";

const initials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

// ── ProCard (sidebar item) ────────────────────────────────────────────────────
function ProCard({ pro, selected, onClick }) {
  const img = firstImage(pro);
  const name = pro.nom_commerce || pro.salon_name || `${pro.nom || ""} ${pro.prenom || ""}`.trim() || "Pro";
  const cat  = pro.categorie || pro.specialite || "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ${
        selected
          ? "bg-orange-50 border border-orange-200"
          : "hover:bg-gray-50 border border-transparent"
      }`}
    >
      {img ? (
        <img
          src={img}
          alt={name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow"
        />
      ) : (
        <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-orange-400 to-orange-600 shadow">
          {initials(name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${selected ? "text-orange-700" : "text-gray-900"}`}>
          {name}
        </p>
        {cat && <p className="text-xs text-gray-500 truncate">{cat}</p>}
      </div>
      {pro.status === "verified" || pro.abonnement ? (
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-400" title="Vérifié" />
      ) : null}
      <ChevronRight size={14} className={selected ? "text-orange-400" : "text-gray-300"} />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminSiteWeb() {
  const [pros, setPros]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selectedPro, setSelectedPro] = useState(null);
  const [generating, setGenerating]   = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState(null);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState(null);
  const iframeRef = useRef(null);

  // Load pro list on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await safeList(entities.ProfilPro, "-created_at", 200);
      setPros(data);
      setLoading(false);
    })();
  }, []);

  // Write HTML into iframe when generatedHtml changes
  useEffect(() => {
    if (!generatedHtml || !iframeRef.current) return;
    try {
      const iframeDoc =
        iframeRef.current.contentDocument ||
        iframeRef.current.contentWindow?.document;
      if (!iframeDoc) return;
      iframeDoc.open();
      iframeDoc.write(generatedHtml);
      iframeDoc.close();
    } catch (e) {
      console.warn("[AdminSiteWeb] iframe write error:", e);
    }
  }, [generatedHtml]);

  const selectPro = useCallback(
    (pro) => {
      setSelectedPro(pro);
      setGeneratedHtml(null);
      setError(null);
    },
    []
  );

  const loadAndGenerate = useCallback(async () => {
    if (!selectedPro) return;
    setGenerating(true);
    setGeneratedHtml(null);
    setError(null);

    try {
      const email = selectedPro.user_email || selectedPro.email;
      const filters = email ? { pro_email: email } : {};

      const [services, bundles, styles, avis, equipe] = await Promise.all([
        safeFilter(entities.Service,       filters),
        safeFilter(entities.ServiceBundle, filters),
        safeFilter(entities.Style,         email ? { pro_email: email } : {}),
        safeFilter(entities.Avis,          selectedPro.id ? { pro_id: selectedPro.id } : {}),
        safeFilter(entities.MembreEquipe,  email ? { pro_email: email } : {}),
      ]);

      const html = generateProWebsite(selectedPro, services, bundles, styles, avis, equipe);
      setGeneratedHtml(html);
    } catch (err) {
      console.error("[AdminSiteWeb] generation error:", err);
      setError(err?.message || "Erreur lors de la génération.");
    } finally {
      setGenerating(false);
    }
  }, [selectedPro]);

  // Download HTML file
  const downloadHtml = useCallback(() => {
    if (!generatedHtml) return;
    const name =
      (selectedPro?.nom_commerce || selectedPro?.salon_name || "site")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
    const blob = new Blob([generatedHtml], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${name}-site.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedHtml, selectedPro]);

  // Copy data: URI to clipboard
  const copyLink = useCallback(async () => {
    if (!generatedHtml) return;
    try {
      const b64  = btoa(unescape(encodeURIComponent(generatedHtml)));
      const uri  = `data:text/html;base64,${b64}`;
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("[AdminSiteWeb] clipboard error:", e);
    }
  }, [generatedHtml]);

  // Filtered pro list
  const filteredPros = pros.filter((p) => {
    const q = search.toLowerCase();
    const name = (p.nom_commerce || p.salon_name || p.nom || "").toLowerCase();
    const cat  = (p.categorie || p.specialite || "").toLowerCase();
    const city = (p.city || p.ville || "").toLowerCase();
    return !q || name.includes(q) || cat.includes(q) || city.includes(q);
  });

  const proName = selectedPro
    ? selectedPro.nom_commerce || selectedPro.salon_name || `${selectedPro.nom || ""} ${selectedPro.prenom || ""}`.trim()
    : "";
  const proImg  = selectedPro ? firstImage(selectedPro) : "";

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="w-80 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Globe size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm leading-tight">Créateur de site web</h2>
              <p className="text-xs text-gray-500">Sélectionnez un professionnel</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="Rechercher un pro…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
          />
        </div>

        {/* Pro list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : filteredPros.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12">
              {search ? "Aucun résultat" : "Aucun professionnel trouvé"}
            </div>
          ) : (
            filteredPros.map((pro) => (
              <ProCard
                key={pro.id}
                pro={pro}
                selected={selectedPro?.id === pro.id}
                onClick={() => selectPro(pro)}
              />
            ))
          )}
        </div>

        {/* Count */}
        {!loading && (
          <div className="p-3 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-400">
              {filteredPros.length} professionnel{filteredPros.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </aside>

      {/* ── Main panel ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedPro ? (
          // Empty state
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
            <div className="w-20 h-20 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Globe size={36} className="text-orange-300" />
            </div>
            <h3 className="font-bold text-xl text-gray-700">Sélectionnez un professionnel</h3>
            <p className="text-gray-400 text-sm max-w-xs">
              Choisissez un professionnel dans la liste pour générer son site web personnalisé.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Pro header */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
              {proImg ? (
                <img
                  src={proImg}
                  alt={proName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-orange-200 shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-orange-400 to-orange-600 shadow">
                  {initials(proName)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base truncate">{proName}</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  {selectedPro.categorie && (
                    <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                      {selectedPro.categorie}
                    </span>
                  )}
                  {(selectedPro.city || selectedPro.ville) && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={11} /> {selectedPro.city || selectedPro.ville}
                    </span>
                  )}
                  {selectedPro.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={11} /> {selectedPro.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {generatedHtml && (
                  <>
                    <button
                      onClick={downloadHtml}
                      title="Télécharger le site HTML"
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Download size={15} />
                      <span className="hidden sm:inline">Télécharger</span>
                    </button>
                    <button
                      onClick={copyLink}
                      title="Copier le lien data: URI"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        copied
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      <span className="hidden sm:inline">{copied ? "Copié !" : "Copier le lien"}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={loadAndGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow transition-all"
                >
                  {generating ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : generatedHtml ? (
                    <RefreshCw size={15} />
                  ) : (
                    <Globe size={15} />
                  )}
                  {generating
                    ? "Génération…"
                    : generatedHtml
                    ? "Regénérer"
                    : "Générer le site web"}
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden relative">
              {error && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow">
                  ⚠️ {error}
                </div>
              )}

              {generating && (
                <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 size={40} className="animate-spin text-orange-400" />
                  <p className="text-gray-500 text-sm font-medium">
                    Génération du site en cours…
                  </p>
                  <p className="text-gray-400 text-xs">Chargement des données du professionnel</p>
                </div>
              )}

              {!generating && !generatedHtml && !error && (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                    <Eye size={28} className="text-orange-300" />
                  </div>
                  <p className="text-gray-500 text-sm max-w-xs">
                    Cliquez sur <strong>Générer le site web</strong> pour créer un site personnalisé pour{" "}
                    <strong>{proName}</strong>.
                  </p>
                </div>
              )}

              {!generating && generatedHtml && (
                <div className="h-full flex flex-col">
                  {/* Preview label */}
                  <div className="bg-gray-100 border-b border-gray-200 px-4 py-1.5 flex items-center gap-2">
                    <Eye size={13} className="text-gray-500" />
                    <span className="text-xs text-gray-500 font-medium">Aperçu du site généré</span>
                    <div className="ml-auto flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                  </div>
                  {/* iframe */}
                  <iframe
                    ref={iframeRef}
                    title="Aperçu site web"
                    className="flex-1 w-full border-0"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
