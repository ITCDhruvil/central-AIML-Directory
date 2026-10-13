import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ZOOM, averageEdgeColor, clampOffset, clampZoom, dragCrop, hasGaps, minZoom, placement, zoomCrop } from "@/lib/avatarCrop";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("minZoom is the ratio of the short side to the long side", () => {
  near(minZoom(1600, 700), 700 / 1600);
  near(minZoom(500, 500), 1);
  near(minZoom(300, 900), 300 / 900);
});

test("clampZoom keeps zoom between 'whole picture' and the maximum", () => {
  near(clampZoom(0.01, 1600, 700), 700 / 1600);
  near(clampZoom(99, 1600, 700), MAX_ZOOM);
  near(clampZoom(2, 1600, 700), 2);
  near(clampZoom(Number.NaN, 1600, 700), 1);
});

test("zoom 1 covers the square: the short side fills it and the long side overhangs, centred", () => {
  const p = placement(1600, 700, { zoom: 1, x: 0, y: 0 });
  near(p.dh, 1);
  near(p.dw, 1600 / 700);
  near(p.dy, 0);
  near(p.dx, 0.5 - 1600 / 700 / 2);
  assert.equal(hasGaps(p), false);
});

test("the smallest zoom shows the whole picture, with gaps on the short side", () => {
  const p = placement(1600, 700, { zoom: minZoom(1600, 700), x: 0, y: 0 });
  near(p.dw, 1);
  near(p.dh, 700 / 1600);
  assert.equal(hasGaps(p), true);
  near(p.dy, (1 - 700 / 1600) / 2);
});

test("clampOffset allows half the overhang, and keeps a small picture centred", () => {
  near(clampOffset(5, 2), 0.5);
  near(clampOffset(-5, 2), -0.5);
  near(clampOffset(0.2, 2), 0.2);
  near(clampOffset(0.3, 0.8), 0);
  near(clampOffset(Number.NaN, 2), 0);
});

test("dragging moves the picture but never past its edges", () => {
  const start = { zoom: 1, x: 0, y: 0 };
  const moved = dragCrop(start, 0.3, 0.3, 1600, 700);
  near(moved.x, 0.3); // wide picture: free to move sideways
  near(moved.y, 0); // short side exactly fills the square: no vertical slack
  const far = dragCrop(start, 10, 0, 1600, 700);
  near(far.x, (1600 / 700 - 1) / 2);
});

test("zooming out re-centres a picture that no longer overhangs", () => {
  const dragged = { zoom: 1, x: 0.5, y: 0 };
  const out = zoomCrop(dragged, minZoom(1600, 700), 1600, 700);
  near(out.x, 0);
  const inward = zoomCrop({ zoom: 1, x: 0, y: 0 }, 2, 1600, 700);
  near(inward.zoom, 2);
});

test("averageEdgeColor averages the border, ignoring the middle", () => {
  // 4x4, opaque: a dark (10,20,30) frame around a bright (250,250,250) centre
  const w = 4;
  const data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === w - 1;
      data.set(edge ? [10, 20, 30, 255] : [250, 250, 250, 255], (y * w + x) * 4);
    }
  }
  assert.deepEqual(averageEdgeColor(data, w, w), [10, 20, 30]);
});

test("averageEdgeColor weights by opacity and falls back to white for a transparent edge", () => {
  const w = 3;
  const clear = new Uint8ClampedArray(w * w * 4); // all transparent
  assert.deepEqual(averageEdgeColor(clear, w, w), [255, 255, 255]);
  assert.deepEqual(averageEdgeColor(new Uint8ClampedArray(0), 0, 0), [255, 255, 255]);
  // half the edge is solid red, half is transparent: the colour is red, not a washed-out mix
  const half = new Uint8ClampedArray(w * w * 4);
  for (let i = 0; i < 4; i++) half.set([200, 0, 0, 255], i * 4);
  assert.deepEqual(averageEdgeColor(half, w, w), [200, 0, 0]);
});
