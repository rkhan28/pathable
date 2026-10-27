export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2048;

export type ImageValidationError = "invalidType" | "tooLarge";

export function validateImage(file: File): ImageValidationError | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return "invalidType";
  if (file.size > MAX_IMAGE_BYTES) return "tooLarge";
  return null;
}

/**
 * Re-encodes the photo through a canvas. This (1) strips EXIF metadata —
 * including GPS coordinates and device info — before anything is uploaded,
 * (2) applies the EXIF orientation, and (3) caps the longest edge at 2048px.
 */
export async function sanitizeImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/jpeg", 0.88),
  );
  return { blob, width, height };
}
