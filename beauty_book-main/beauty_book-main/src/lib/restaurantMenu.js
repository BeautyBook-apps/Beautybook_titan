/**
 * Shared restaurant-menu shape used by the onboarding flow, the professional
 * editor and all client-facing profile views.
 */
export function createRestaurantMenuItem() {
  return { nom: "", prix: "", description: "", image_url: "", is_free: false };
}

export function isMenuItemFree(item) {
  if (!item) return false;
  const flag = item.is_free ?? item.gratuit ?? item.free;
  if (flag === true || String(flag).toLowerCase() === "true") return true;
  return String(item.prix ?? "").trim().toLowerCase() === "gratuit";
}

export function menuItemPriceLabel(item) {
  if (isMenuItemFree(item)) return "Offert";
  const rawPrice = String(item?.prix ?? "").trim();
  return rawPrice ? `${rawPrice}€` : "";
}
