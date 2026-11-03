/**
 * Prepare a photo for upload entirely on the device: decode, downscale to at
 * most 1600 px on the long edge, and re-encode through a canvas. Re-encoding
 * drops every EXIF field, including GPS location, camera serial and time.
 * The server strips metadata again and blurs faces and plates before any
 * photo is public (services/api), so this is the first of two layers.
 */
export const MAX_EDGE_PX = 1600;

export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

/** True if a JPEG still contains an EXIF APP1 segment (used by tests). */
export async function hasExif(blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
  for (let i = 2; i + 4 < bytes.length; ) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && String.fromCharCode(...bytes.slice(i + 4, i + 8)) === "Exif") return true;
    if (marker === 0xda) return false;
    i += 2 + len;
  }
  return false;
}
