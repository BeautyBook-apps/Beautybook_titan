/**
 * Hook pour gérer les produits likés (favoris) — stockés en localStorage
 * Chaque produit liké contient : id, name, brand, price, img, category_hint
 */
import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { likesApi } from "@/api/likes";

const STORAGE_KEY = "bb_liked_products";

export function getLikedProducts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

// Catégorie automatique basée sur le nom/catégorie du produit
export function guessClothingCategory(product) {
  const text = ((product.name || "") + " " + (product.category || "") + " " + (product.brand || "")).toLowerCase();
  if (/chaussure|sneaker|basket|talon|botte|sandale|mocassin|espadrille|shoe|boot/.test(text)) return "shoes";
  if (/pantalon|jean|jupe|short|legging|bas|trouser|skirt|culotte|collant|legging/.test(text)) return "bottom";
  if (/chapeau|casquette|bonnet|hat|cap|turban/.test(text)) return "hat";
  if (/sac|bag|pochette|clutch|handbag/.test(text)) return "bag";
  // Par défaut → haut
  return "top";
}

export function useLikedProducts() {
  const [liked, setLiked] = useState(() => {
    return getLikedProducts();
  });

  const save = (items) => {
    setLiked(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const toggle = (product) => {
    const exists = liked.find(p => p.id === product.id);
    if (exists) {
      save(liked.filter(p => p.id !== product.id));
    } else {
      save([...liked, {
        ...product,
        clothing_category: guessClothingCategory(product),
        favorite_created_at: new Date().toISOString(),
      }]);
    }

    // Garder le favori local disponible hors connexion, tout en enregistrant
    // le like du produit dans Supabase pour calculer le compteur public.
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email;
      if (!email) return;
      return exists
        ? likesApi.removeLike(email, product.id, "produit")
        : likesApi.addLike(email, product.id, "produit", data.user.user_metadata?.full_name || "", data.user.user_metadata?.avatar_url || "");
    }).catch(error => console.warn("[useLikedProducts] Like produit non synchronisé:", error?.message));
  };

  const isLiked = (id) => liked.some(p => p.id === id);

  return { liked, toggle, isLiked };
}
