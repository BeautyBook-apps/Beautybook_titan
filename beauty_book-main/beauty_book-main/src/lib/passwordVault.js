// Coffre de mot de passe chiffré sur l'appareil.
// Le mot de passe n'est JAMAIS envoyé au serveur : il est chiffré en AES-GCM via
// WebCrypto et stocké localement. Sa révélation dans la page Sécurité est
// conditionnée à un déverrouillage natif de l'appareil (WebAuthn :
// Face ID / empreinte / code PIN de l'appareil).

const vaultKey = (userId) => `bb_pwd_vault_${userId}`;
const dekKey = (userId) => `bb_pwd_dek_${userId}`;

function b64encode(bytes) {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function b64decode(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function importDek(raw) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function hasSavedPassword(userId) {
  if (!userId) return false;
  return Boolean(localStorage.getItem(vaultKey(userId)) && localStorage.getItem(dekKey(userId)));
}

export async function savePassword(userId, password) {
  if (!userId || !password) return;
  if (!window.crypto?.subtle) throw new Error("Chiffrement indisponible sur cet appareil.");
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const key = await importDek(dek);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(password));
  localStorage.setItem(vaultKey(userId), JSON.stringify({ iv: b64encode(iv), data: b64encode(new Uint8Array(data)) }));
  localStorage.setItem(dekKey(userId), b64encode(dek));
}

export async function revealPassword(userId) {
  const rawVault = localStorage.getItem(vaultKey(userId));
  const rawDek = localStorage.getItem(dekKey(userId));
  if (!rawVault || !rawDek) throw new Error("Aucun mot de passe enregistré sur cet appareil.");
  const vault = JSON.parse(rawVault);
  const key = await importDek(b64decode(rawDek));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(vault.iv) },
    key,
    b64decode(vault.data)
  );
  return new TextDecoder().decode(plain);
}

export function clearPassword(userId) {
  if (!userId) return;
  localStorage.removeItem(vaultKey(userId));
  localStorage.removeItem(dekKey(userId));
}
