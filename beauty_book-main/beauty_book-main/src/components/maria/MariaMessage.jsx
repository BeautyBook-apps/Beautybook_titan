import ReactMarkdown from "react-markdown";
import { Volume2, VolumeX } from "lucide-react";
import MariaChart, { parseChartSpec } from "./MariaChart";

/**
 * Rendu markdown ultra-soigné pour les messages de Maria.
 * Gras en orange · listes belles · titres élégants · emojis intégrés
 * + blocs ```chart → vrais graphiques colorés (barres, donut, KPI…)
 */
export default function MariaMessage({ content, onSpeak, muted, onToggleMuted, voiceUrl }) {
  const playVoicebox = () => {
    if (voiceUrl) {
      const audio = new Audio(voiceUrl);
      audio.play().catch(() => {});
    } else if (onSpeak) {
      onSpeak();
    }
  };
  return (
    <div className="text-[13.5px] leading-[1.7] text-gray-700 font-display">
      <ReactMarkdown
        components={{
          // Paragraphe
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0">{children}</p>
          ),

          // Gras → orange vif avec légère lueur
          strong: ({ children }) => (
            <strong className="font-black text-primary drop-shadow-[0_0_8px_rgba(232,115,42,0.25)]">
              {children}
            </strong>
          ),

          // Italique — style serif élégant
          em: ({ children }) => (
            <em className="font-serif italic text-gray-500 not-italic" style={{ fontStyle: "italic" }}>{children}</em>
          ),

          // H1 — grand titre avec gradient
          h1: ({ children }) => (
            <h1 className="text-[18px] font-black mt-4 mb-2 pb-1.5 border-b border-orange-100 bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              {children}
            </h1>
          ),

          // H2 — sous-titre avec puce orange
          h2: ({ children }) => (
            <h2 className="text-[15px] font-black text-gray-900 mt-3 mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-gradient-to-b from-primary to-orange-400 rounded-full shrink-0 inline-block" />
              {children}
            </h2>
          ),

          // H3
          h3: ({ children }) => (
            <h3 className="text-[13px] font-black text-primary mt-2 mb-1 uppercase tracking-wide">
              {children}
            </h3>
          ),

          // Liste non ordonnée — puces douces
          ul: ({ children }) => (
            <ul className="my-2.5 space-y-1.5">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0 shadow-sm shadow-primary/40" />
              <span className="flex-1">{children}</span>
            </li>
          ),

          // Liste ordonnée
          ol: ({ children }) => (
            <ol className="my-2.5 space-y-1.5 list-none pl-0">{children}</ol>
          ),

          // Tableau stylé
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-2xl border border-orange-100 shadow-sm">
              <table className="w-full text-[12px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ background: "linear-gradient(90deg, #E8732A, #f59540)" }} className="text-white">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[10px]">{children}</th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-orange-50">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-orange-50/40 hover:bg-orange-50/70 transition-colors">{children}</tr>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-gray-700">{children}</td>
          ),

          // Code inline — et blocs ```chart → graphique réel
          code: ({ inline, className, children }) => {
            const lang = /language-(\w+)/.exec(String(className || ""))?.[1];
            if (lang === "chart") {
              // Bloc incomplet (frappe en cours) ou JSON invalide → on
              // n'affiche rien plutôt qu'un graphique faux ou du JSON brut.
              const spec = parseChartSpec(String(children ?? ""));
              if (!spec) return null;
              return <MariaChart spec={spec} />;
            }
            return inline ? (
              <code className="bg-orange-50 text-primary px-1.5 py-0.5 rounded-lg font-mono text-[11px] border border-orange-100">
                {children}
              </code>
            ) : (
              <pre className="bg-gray-900 text-emerald-400 rounded-2xl p-3.5 my-3 overflow-x-auto text-[11px] font-mono shadow-lg">
                <code>{children}</code>
              </pre>
            );
          },

          // Blockquote — effet carte conseil
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-primary pl-3.5 my-3 bg-gradient-to-r from-orange-50 to-transparent py-2 pr-3 rounded-r-xl">
              <div className="text-gray-600 italic text-[12.5px] leading-relaxed">{children}</div>
            </blockquote>
          ),

          // Séparateur décoratif
          hr: () => (
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-orange-200" />
              <span className="text-[10px] text-orange-300">✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-orange-200" />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {(onSpeak || onToggleMuted) && (
        <div className="mt-2 flex items-center gap-2">
          {onSpeak && (
            <button
              onClick={playVoicebox}
              className="opacity-25 hover:opacity-60 transition-opacity inline-flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-primary"
            >
              <Volume2 className="w-3 h-3" />
              <span className="font-medium">Réécouter</span>
            </button>
          )}
          {onToggleMuted !== undefined && (
            <button
              onClick={onToggleMuted}
              className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 transition-all ${muted ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              title={muted ? "Activer le son" : "Couper le son"}
            >
              {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              <span className="font-black">{muted ? "Muet" : "Son"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}