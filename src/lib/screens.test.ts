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
