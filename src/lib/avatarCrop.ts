// Browser-safe maths for positioning a picture inside the square (shown as a circle) that becomes a profile picture.
//
// Everything is in "viewport units": the visible square is 1 × 1 and its centre is (0.5, 0.5). A picture's zoom is
// relative to "cover", the size at which it just fills the square (zoom 1). Smaller zooms let the whole picture fit.

export const MAX_ZOOM = 4;

export type Crop = { zoom: number; x: number; y: number };

/** The smallest zoom, where the whole picture is visible (the long side exactly fits). */
export function minZoom(width: number, height: number): number {
  return Math.min(width, height) / Math.max(width, height);
}

export function clampZoom(zoom: number, width: number, height: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(minZoom(width, height), zoom));
}

/**
 * Keeps the picture from being dragged off the square. A side that is bigger than the square can move by half the
 * overhang either way; a side that is smaller stays centred.
 */
export function clampOffset(offset: number, drawnSize: number): number {
  if (!Number.isFinite(offset) || drawnSize <= 1) return 0;
  const limit = (drawnSize - 1) / 2;
  return Math.min(limit, Math.max(-limit, offset));
}

export type Placement = { dx: number; dy: number; dw: number; dh: number };

/** Where to draw the picture, in viewport units, for a given crop. Out-of-range values are pulled back in. */
export function placement(
  width: number,
  height: number,
  crop: Crop,
): Placement {
  const zoom = clampZoom(crop.zoom, width, height);
  const scale = (1 / Math.min(width, height)) * zoom; // viewport units per source pixel
  const dw = width * scale;
  const dh = height * scale;
  const x = clampOffset(crop.x, dw);
  const y = clampOffset(crop.y, dh);
  return { dx: 0.5 + x - dw / 2, dy: 0.5 + y - dh / 2, dw, dh };
}

/** True when the picture doesn't cover the whole square, so the gaps need a background. */
export function hasGaps(p: Placement): boolean {
  const eps = 1e-6;
  return p.dw < 1 - eps || p.dh < 1 - eps;
}

/** A drag of `deltaUnits` moves the picture by that much, and the result stays on the square. */
export function dragCrop(
  start: Crop,
  deltaX: number,
  deltaY: number,
  width: number,
  height: number,
): Crop {
  const p = placement(width, height, start);
  return {
    zoom: start.zoom,
    x: clampOffset(start.x + deltaX, p.dw),
    y: clampOffset(start.y + deltaY, p.dh),
  };
}

/** Changes the zoom and re-clamps the offsets, so zooming out never leaves the picture hanging off-centre. */
export function zoomCrop(
  crop: Crop,
  zoom: number,
  width: number,
  height: number,
): Crop {
  const z = clampZoom(zoom, width, height);
  const p = placement(width, height, { ...crop, zoom: z });
  return {
    zoom: z,
    x: clampOffset(crop.x, p.dw),
    y: clampOffset(crop.y, p.dh),
  };
}

/**
 * The average colour of a picture's outer edge (RGBA pixel data, as from a canvas), weighted by opacity. It fills the
 * gaps when a picture is zoomed out to fit, so they blend into the picture instead of showing as white bands that make
 * the circle look like a rectangle. A picture whose edge is transparent (or empty) falls back to white.
 */
export function averageEdgeColor(
  data: ArrayLike<number>,
  width: number,
  height: number,
): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
      const i = (y * width + x) * 4;
      const a = (data[i + 3] ?? 0) / 255;
      r += (data[i] ?? 0) * a;
      g += (data[i + 1] ?? 0) * a;
      b += (data[i + 2] ?? 0) * a;
      weight += a;
      count += 1;
    }
  }
  if (count === 0 || weight < count * 0.1) return [255, 255, 255];
  return [
    Math.round(r / weight),
    Math.round(g / weight),
    Math.round(b / weight),
  ];
}
