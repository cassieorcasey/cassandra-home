import { expect, test } from 'vitest';
import { clampPage, nextPageFromSwipe, pageCount, pageOf, TABS_PER_PAGE } from './taskbar';

test('four tabs per page', () => expect(TABS_PER_PAGE).toBe(4));
test('pageCount', () => {
  expect(pageCount(0)).toBe(1);
  expect(pageCount(4)).toBe(1);
  expect(pageCount(5)).toBe(2);
});
test('pageOf', () => {
  expect(pageOf(3)).toBe(0);
  expect(pageOf(4)).toBe(1);
});
test('clampPage pulls back to the last page that exists', () => {
  expect(clampPage(1, 4)).toBe(0);
  expect(clampPage(-1, 5)).toBe(0);
  expect(clampPage(1, 5)).toBe(1);
});
test('nextPageFromSwipe', () => {
  expect(nextPageFromSwipe(0, 5, -200, 400, 0)).toBe(1);
  expect(nextPageFromSwipe(0, 5, -50, 400, 0)).toBe(0);
  expect(nextPageFromSwipe(0, 5, -50, 400, -800)).toBe(1);
  expect(nextPageFromSwipe(1, 5, -200, 400, 0)).toBe(1);
  expect(nextPageFromSwipe(1, 5, 200, 400, 0)).toBe(0);
});

import { tabSlotRect } from './taskbar';
const desk = { w: 1440, h: 900, mobile: false, sab: 0, sat: 0 };
test('tabSlotRect: single tab is centred in a one-slot bar', () => {
  expect(tabSlotRect(desk, 1, 0, 0)).toEqual({ left: 698, top: 834, width: 44, height: 44, borderRadius: 13 });
});
test('tabSlotRect: five tabs, first page shows four slots plus page dots', () => {
  // bar = 10 + 218 + 10 + 5 + 10 = 253 lebar, kiri 593.5
  expect(tabSlotRect(desk, 5, 0, 0).left).toBe(603.5);
  expect(tabSlotRect(desk, 5, 3, 0).left).toBe(603.5 + 3 * 58);
});
test('tabSlotRect: fifth tab sits alone on page two', () => {
  expect(tabSlotRect(desk, 5, 4, 1).left).toBe(720 - (20 + 44 + 15) / 2 + 10);
});
test('tabSlotRect: lifts above the bottom safe area', () => {
  expect(tabSlotRect({ ...desk, sab: 34 }, 1, 0, 0).top).toBe(800);
});

import { screenCapacity } from './taskbar';
const phoneVp = { w: 390, h: 844, sab: 34 };
test('capacity K: 4 on desktop, 2 on phones', () => {
  expect(screenCapacity(false)).toBe(4);
  expect(screenCapacity(true)).toBe(2);
});
test('paging takes K', () => {
  expect(pageCount(3, 2)).toBe(2);
  expect(pageOf(2, 2)).toBe(1);
  expect(clampPage(2, 3, 2)).toBe(1);
  expect(nextPageFromSwipe(0, 3, -200, 400, 0, 2)).toBe(1);
});
test('tabSlotRect with K = 2', () => {
  expect(tabSlotRect(phoneVp, 3, 2, 1, 2).left).toBe(195 - (20 + 44 + 15) / 2 + 10);
  expect(tabSlotRect(phoneVp, 2, 1, 0, 2).left).toBe(195 - (20 + 44 * 2 + 14) / 2 + 10 + 58);
});
