// Upload validation that does not trust the client-declared MIME type or filename.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type SniffedType = (typeof ACCEPTED_MIME)[number];

/** Identify the real file type from its magic bytes. */
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function checkUpload(size: number, bytes: Uint8Array): { ok: true; type: SniffedType } | { ok: false; error: string } {
  if (size === 0) return { ok: false, error: "הקובץ ריק" };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: "הקובץ גדול מ-5MB" };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "אפשר להעלות רק JPG, PNG או WEBP" };
  return { ok: true, type };
}
