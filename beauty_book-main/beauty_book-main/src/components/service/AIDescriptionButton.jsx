import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { entities } from '@/api/entities';
import { useAuth } from "@/lib/AuthContext";

import { grokChat } from '@/lib/grok';

export default function AIDescriptionButton({ serviceName, category, onDescription }) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isPaid, setIsPaid] = useState(null);

  useEffect(() => {
    if (!user?.email) return;
    entities.ProfilPro.filter({ user_email: user.email }, "-created_at", 1)
      .then(rows => {
        const abo = rows[0]?.abonnement || "free";
        setIsPaid(abo !== "free");
      })
      .catch(() => setIsPaid(false));
  }, [user?.email]);

  const handleGenerate = async () => {
    if (!serviceName?.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const prompt = `Tu es un expert en coiffure et beauté. Rédige une description professionnelle et attrayante pour une prestation de beauté nommée "${serviceName}" dans la catégorie "${category || 'beauté'}". La description doit faire 2 à 3 phrases, être en français, mettre en valeur l'expertise, la technique et le résultat final. Format : uniquement le texte de la description, sans guillemets ni markdown.`;

      const content = (await grokChat([{ role: 'user', content: prompt }], { max_tokens: 300 }))?.trim();
      if (content) {
        onDescription(content);
      } else {
        throw new Error("Réponse IA vide");
      }
    } catch (e) {
      console.error("[AI Description] Error:", e);
      setError("Erreur lors de la génération. Réessayez.");
      setTimeout(() => setError(""), 3000);
    } finally {
      setGenerating(false);
    }
  };

  if (isPaid === null) return null;
  if (!isPaid) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !serviceName?.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-600 text-[12px] font-black active:scale-95 transition-all disabled:opacity-50 hover:bg-purple-100"
      >
        {generating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Génération...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Générer avec l'IA
          </>
        )}
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 text-[10px] text-red-500 font-medium whitespace-nowrap z-10 bg-white rounded-lg px-2 py-1 shadow-md border border-red-100">
          {error}
        </p>
      )}
    </div>
  );
}
