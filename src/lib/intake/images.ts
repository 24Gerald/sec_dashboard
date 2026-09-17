/**
 * Screenshot helpers for report intake — compress large captures so they stay
 * usable as evidence without blowing local draft storage.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 4 * 1024 * 1024; // soft cap before we refuse

export interface PreparedShot {
  id: string;
  name: string;
  /** Object/data URL for previews and offline evidence */
  preview: string;
  /** Compressed file ready for /api/upload */
  file: File;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(file.name);
}

/** Turn a File (or clipboard image) into a compressed JPEG shot. */
export async function prepareShot(file: File): Promise<PreparedShot> {
  if (file.size > MAX_BYTES * 3) throw new Error(`${file.name} is too large (max ~12 MB)`);
  const bitmap = await fileToBitmap(file);
  try {
    const { blob, width, height } = await compressBitmap(bitmap);
    const base = file.name.replace(/\.[^.]+$/, '') || 'screenshot';
    const name = `${base}.jpg`;
    const out = new File([blob], name, { type: 'image/jpeg' });
    const preview = URL.createObjectURL(blob);
    return {
      id: `shot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: width && height ? name : file.name,
      preview,
      file: out,
    };
  } finally {
    bitmap.close();
  }
}

export function revokeShot(shot: PreparedShot) {
  try { URL.revokeObjectURL(shot.preview); } catch { /* already revoked */ }
}

async function fileToBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  // Fallback for older environments: decode via <img>
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read image');
    ctx.drawImage(img, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

async function compressBitmap(bitmap: ImageBitmap): Promise<{ blob: Blob; width: number; height: number }> {
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not compress image');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', JPEG_QUALITY);
  });
  if (blob.size > MAX_BYTES) throw new Error('Screenshot is still too large after compression — try a smaller crop');
  return { blob, width, height };
}

/** Offline fallback: data URL so evidence survives draft persistence. */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}
