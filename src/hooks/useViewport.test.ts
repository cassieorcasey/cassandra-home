import { expect, test } from 'vitest';
import { BAR_RESERVED, clampWindowRect, stageRect, type Viewport } from './useViewport';

const desk: Viewport = { w: 1440, h: 900, mobile: false, sab: 0, sat: 0 };
const phone: Viewport = { w: 390, h: 844, mobile: true, sab: 34, sat: 47 };

test('bar reserve is bar height plus gap', () => expect(BAR_RESERVED).toBe(88));
test('desktop stage uses full width and leaves room for the bar', () => {
  expect(stageRect(desk, false)).toEqual({ x: 24, y: 12, w: 1392, h: 900 - 12 - 12 - 88 });
});
test('phone stage leaves room for the bar', () => {
  expect(stageRect(phone, false)).toEqual({ x: 0, y: 47, w: 390, h: 844 - 47 - 34 - 88 });
});
test('windows may reach the left edge but never sit under the bar', () => {
  const r = clampWindowRect({ x: 0, y: 800, w: 500, h: 400 }, desk);
  expect(r.x).toBe(8);
  expect(r.y + r.h).toBeLessThanOrEqual(900 - 8 - 88);
});
