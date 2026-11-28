import { expect, test } from 'vitest';
import { gridCells, screenLayout } from './screens';

const stage = { x: 24, y: 12, w: 1392, h: 788 };

test('one app fills the stage', () => {
  expect(gridCells(stage, 1, 12)).toEqual([stage]);
});
test('two apps side by side on a landscape stage', () => {
  expect(gridCells(stage, 2, 12)).toEqual([
    { x: 24, y: 12, w: 690, h: 788 },
    { x: 726, y: 12, w: 690, h: 788 },
  ]);
});
test('three apps: first full height, two stacked on the other side', () => {
  expect(gridCells(stage, 3, 12)).toEqual([
    { x: 24, y: 12, w: 690, h: 788 },
    { x: 726, y: 12, w: 690, h: 388 },
    { x: 726, y: 412, w: 690, h: 388 },
  ]);
});
test('four apps in a 2x2 grid', () => {
  expect(gridCells(stage, 4, 12)).toEqual([
    { x: 24, y: 12, w: 690, h: 388 },
    { x: 726, y: 12, w: 690, h: 388 },
    { x: 24, y: 412, w: 690, h: 388 },
    { x: 726, y: 412, w: 690, h: 388 },
  ]);
});
test('portrait stage splits top and bottom first', () => {
  expect(gridCells({ x: 0, y: 0, w: 400, h: 800 }, 2, 8)).toEqual([
    { x: 0, y: 0, w: 400, h: 396 },
    { x: 0, y: 404, w: 400, h: 396 },
  ]);
  const three = gridCells({ x: 0, y: 0, w: 400, h: 800 }, 3, 8);
  expect(three[0]).toEqual({ x: 0, y: 0, w: 400, h: 396 });
  expect(three[1]).toEqual({ x: 0, y: 404, w: 196, h: 396 });
});
test('screenLayout keeps only visible apps on that screen', () => {
  const tabs = ['lemma', 'synthesis', 'conway', 'subset', 'wishy'] as const;
  const m = screenLayout([...tabs], new Set(['synthesis'] as const), 0, 4, stage, 12);
  expect([...m.keys()]).toEqual(['lemma', 'conway', 'subset']);
  expect(m.get('lemma')).toEqual({ x: 24, y: 12, w: 690, h: 788 });
  const s2 = screenLayout([...tabs], new Set(), 1, 4, stage, 12);
  expect([...s2.keys()]).toEqual(['wishy']);
});

import { screenFrame } from './screens';
const deskStage = { x: 24, y: 12, w: 1392, h: 788 };
const desk = { w: 1440, peek: 54, gap: 12, margin: 24 };
test('screenFrame: one screen keeps the plain stage', () => {
  expect(screenFrame(deskStage, desk, 0, 1, 0)).toEqual(deskStage);
});
test('screenFrame: first of two screens leaves room for the next one to peek', () => {
  expect(screenFrame(deskStage, desk, 0, 2, 0)).toEqual({ x: 24, y: 12, w: 1350, h: 788 });
  // layar 2 mulai di 1440 - 54: tepinya terlihat 54 px
  expect(screenFrame(deskStage, desk, 1, 2, 0).x).toBe(1386);
});
test('screenFrame: on the second screen the first one peeks on the left', () => {
  expect(screenFrame(deskStage, desk, 1, 2, 1)).toEqual({ x: 66, y: 12, w: 1308, h: 788 });
  const prev = screenFrame(deskStage, desk, 0, 2, 1);
  expect(prev.x + prev.w).toBe(54);
});
test('screenFrame: phone peek is 24 px', () => {
  const st = { x: 0, y: 47, w: 390, h: 675 };
  const ph = { w: 390, peek: 24, gap: 8, margin: 8 };
  expect(screenFrame(st, ph, 0, 2, 0)).toEqual({ x: 8, y: 47, w: 350, h: 675 });
  expect(screenFrame(st, ph, 1, 2, 0).x).toBe(366);
});

import { clampRatio, splitLines } from './screens';
const st = { x: 24, y: 12, w: 1392, h: 788 };
test('gridCells honours split ratios (2 apps, 30/70)', () => {
  const [a, b] = gridCells(st, 2, 12, { r1: 0.3, r2: 0.5 });
  expect(a.w).toBeCloseTo((1392 - 12) * 0.3);
  expect(b.x).toBeCloseTo(24 + (1392 - 12) * 0.3 + 12);
  expect(a.w + b.w + 12).toBeCloseTo(1392);
});
test('gridCells 4 apps: r1 sets the column, r2 the shared row line', () => {
  const c = gridCells(st, 4, 12, { r1: 0.6, r2: 0.25 });
  expect(c[0].w).toBeCloseTo((1392 - 12) * 0.6);
  expect(c[0].h).toBeCloseTo((788 - 12) * 0.25);
  expect(c[1].h).toBeCloseTo((788 - 12) * 0.25);
  expect(c[2].y).toBeCloseTo(12 + (788 - 12) * 0.25 + 12);
});
test('default ratios keep the old even grid', () => {
  expect(gridCells(st, 4, 12)).toEqual(gridCells(st, 4, 12, { r1: 0.5, r2: 0.5 }));
});
test('clampRatio keeps both sides at least the minimum size', () => {
  expect(clampRatio(0.05, 1380, 320)).toBeCloseTo(320 / 1380);
  expect(clampRatio(0.99, 1380, 320)).toBeCloseTo(1 - 320 / 1380);
  expect(clampRatio(0.4, 1380, 320)).toBe(0.4);
  expect(clampRatio(0.9, 500, 320)).toBe(0.5); // too small for two minimums: stay centred
});
test('splitLines: where the draggable dividers sit', () => {
  expect(splitLines(st, 1, 12)).toEqual([]);
  const two = splitLines(st, 2, 12);
  expect(two).toEqual([{ key: 'r1', axis: 'x', rect: { x: 24 + 690, y: 12, w: 12, h: 788 }, span: 1380, origin: 24 }]);
  const three = splitLines(st, 3, 12);
  expect(three.map((l) => l.key)).toEqual(['r1', 'r2']);
  expect(three[1]).toMatchObject({ axis: 'y', rect: { x: 726, y: 12 + 388, w: 690, h: 12 } });
  const four = splitLines(st, 4, 12);
  expect(four[1]).toMatchObject({ key: 'r2', axis: 'y', rect: { x: 24, y: 400, w: 1392, h: 12 } });
});

import { resizeRect } from './screens';
const box = { x: 24, y: 12, w: 1392, h: 788 };
const win = { x: 224, y: 112, w: 800, h: 500 };
test('resizeRect: east edge widens', () => {
  expect(resizeRect(win, 'e', 100, 0, box)).toEqual({ x: 224, y: 112, w: 900, h: 500 });
});
test('resizeRect: west edge moves the left side and keeps the right side', () => {
  expect(resizeRect(win, 'w', -100, 0, box)).toEqual({ x: 124, y: 112, w: 900, h: 500 });
});
test('resizeRect: south-west corner', () => {
  expect(resizeRect(win, 'sw', 50, 40, box)).toEqual({ x: 274, y: 112, w: 750, h: 540 });
});
test('resizeRect: never smaller than 360 x 260', () => {
  expect(resizeRect(win, 'se', -2000, -2000, box)).toEqual({ x: 224, y: 112, w: 360, h: 260 });
  expect(resizeRect(win, 'w', 2000, 0, box)).toEqual({ x: 224 + 800 - 360, y: 112, w: 360, h: 500 });
});
test('resizeRect: never past the stage', () => {
  expect(resizeRect(win, 'se', 5000, 5000, box)).toEqual({ x: 224, y: 112, w: 24 + 1392 - 224, h: 12 + 788 - 112 });
  expect(resizeRect(win, 'w', -5000, 0, box)).toEqual({ x: 24, y: 112, w: 224 + 800 - 24, h: 500 });
});
