// build.mjs 와 형식이 같아야 합니다: PBKDF2-SHA256 → AES-256-GCM
export const ITERATIONS = 250000;
const SALT_LEN = 16;
const IV_LEN = 12;

export async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

export async function decrypt(key, buf) {
  const bytes = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, IV_LEN) }, key, bytes.slice(IV_LEN));
}

// manifest.enc = salt | iv | ciphertext+tag
export async function openManifest(password, buf) {
  const bytes = new Uint8Array(buf);
  const key = await deriveKey(password, bytes.slice(0, SALT_LEN));
  const json = new TextDecoder().decode(await decrypt(key, bytes.slice(SALT_LEN)));
  return JSON.parse(json);
}

export async function importFileKey(b64) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}
