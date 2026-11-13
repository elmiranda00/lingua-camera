// Photo capture and preparation for OCR (photos never leave the device)
import { fitSize } from "./geometry.ts";

// Current frame of the live viewfinder as a JPEG
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No 2D canvas"));
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode frame"))), "image/jpeg", 0.85),
  );
}

// Decodes with EXIF rotation applied and shrinks to the OCR size; the original blob stays for display
export async function toOcrBitmap(blob: Blob): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const full = await createImageBitmap(blob);
  const { width, height } = fitSize(full.width, full.height);
  if (width === full.width && height === full.height) return { bitmap: full, width, height };
  const bitmap = await createImageBitmap(full, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
  full.close();
  return { bitmap, width, height };
}
