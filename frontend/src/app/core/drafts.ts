/**
 * Borradores locales de la hoja de personaje (localStorage).
 * Sirven para no perder lo escrito si se recarga la página o se cierra la pestaña.
 * Todo va envuelto en try/catch: en modo privado o sin espacio, simplemente no se guarda.
 */
export interface Draft<T> {
  value: T;
  savedAt: string;      // ISO
  avatar?: string | null; // data URL (solo personajes nuevos, aún sin subir)
}

const PREFIX = 'helios_draft';

export const draftKey = (userId: number | undefined, characterId: number | null) =>
  `${PREFIX}_${userId ?? 'anon'}_${characterId ?? 'nuevo'}`;

export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft<T>) : null;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, draft: Draft<T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Si no cabe con el avatar, lo intentamos sin él
    try {
      localStorage.setItem(key, JSON.stringify({ ...draft, avatar: null }));
    } catch { /* sin almacenamiento disponible */ }
  }
}

export function clearDraft(key: string): void {
  try { localStorage.removeItem(key); } catch { /* nada */ }
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

export const dataUrlToBlob = (url: string) => fetch(url).then((r) => r.blob());
