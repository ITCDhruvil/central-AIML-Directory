// Browser-only: loads a chosen picture and renders the part the person framed into a small square, ready to upload.
import {
  averageEdgeColor,
  hasGaps,
  placement,
  type Crop,
} from "@/lib/avatarCrop";

export type LoadedPicture = {
  bitmap: ImageBitmap;
  /** A temporary URL for showing the picture in the editor. Release it with `releasePicture`. */
  url: string;
  width: number;
  height: number;
  /** CSS colour matching the picture's edge. It fills any gaps, so a zoomed-out picture still looks round. */
  edgeColor: string;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The average colour around the picture's edge, from a small copy of it. White if that can't be read. */
function sampleEdgeColor(bitmap: ImageBitmap): string {
  const SAMPLE = 32;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "rgb(255,255,255)";
    ctx.drawImage(bitmap, 0, 0, SAMPLE, SAMPLE);
    const [r, g, b] = averageEdgeColor(
      ctx.getImageData(0, 0, SAMPLE, SAMPLE).data,
      SAMPLE,
      SAMPLE,
    );
    return `rgb(${r},${g},${b})`;
  } catch {
    return "rgb(255,255,255)";
  }
}

/** Reads the chosen file as a picture. Throws an Error with a readable message if it isn't a usable image. */
export async function loadPicture(file: File): Promise<LoadedPicture> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "That file couldn't be read as a picture. Use a JPEG, PNG or WebP image.",
    );
  }
  return {
    bitmap,
    url: URL.createObjectURL(file),
    width: bitmap.width,
    height: bitmap.height,
    edgeColor: sampleEdgeColor(bitmap),
  };
}

export function releasePicture(picture: LoadedPicture): void {
  URL.revokeObjectURL(picture.url);
  picture.bitmap.close();
}

/**
 * Draws the framed part of the picture into a `size`-pixel square and encodes it as WebP (JPEG where the browser can't
 * make WebP). The upload is a few tens of KB however big the original was, and metadata such as location is dropped,
 * since only the pixels are redrawn. If the picture was zoomed out so it doesn't fill the square, the gaps take the colour
 * of the picture's edge.
 */
export async function renderAvatar(
  picture: LoadedPicture,
  crop: Crop,
  size: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't resize pictures.");

  const p = placement(picture.width, picture.height, crop);
  if (hasGaps(p)) {
    ctx.fillStyle = picture.edgeColor;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    picture.bitmap,
    p.dx * size,
    p.dy * size,
    p.dw * size,
    p.dh * size,
  );

  const blob =
    (await canvasToBlob(canvas, "image/webp", 0.9)) ??
    (await canvasToBlob(canvas, "image/jpeg", 0.9));
  if (!blob)
    throw new Error("Couldn't prepare that picture. Try a different one.");
  return blob;
}
