import { expect, test } from 'vitest';
import { initial, reducer, tabIds } from './useWindowManager';

const open = (...ids: Parameters<typeof tabIds>[0]['activeId'][]) =>
  ids.reduce((s, id) => reducer(s, { type: 'launch', id: id!, flight: null }), initial);

test('tabs follow open order and survive minimize', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'minimize', id: 'conway', flight: null, next: null });
  expect(tabIds(s)).toEqual(['lemma', 'conway']);
  expect(s.activeId).toBeNull();
  expect(s.wins.find((w) => w.id === 'conway')!.minimized).toBe(true);
});

test('focus restores a minimized tab without reordering', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'minimize', id: 'conway', flight: null, next: null });
  s = reducer(s, { type: 'focus', id: 'lemma' });
  expect(s.activeId).toBe('lemma');
  expect(tabIds(s)).toEqual(['lemma', 'conway']);
});

test('close removes the tab', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'close', id: 'conway', flight: null, next: null });
  expect(tabIds(s)).toEqual(['lemma']);
  expect(s.activeId).toBeNull();
});

test('state has no deck', () => {
  expect('deck' in initial).toBe(false);
});

test('minimize hands focus to the next visible window', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'minimize', id: 'conway', flight: null, next: 'lemma' });
  expect(s.activeId).toBe('lemma');
  expect(s.wins.find((w) => w.id === 'conway')!.minimized).toBe(true);
  expect(s.wins.find((w) => w.id === 'lemma')!.minimized).toBe(false);
});

test('focusing one window leaves the others untouched', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'focus', id: 'lemma' });
  expect(s.wins.every((w) => !w.minimized)).toBe(true);
});

test('windows carry no free-form rect any more', () => {
  const s = open('lemma');
  expect('rect' in s.wins[0]).toBe(false);
  // @ts-expect-error setRect no longer exists
  expect(reducer(s, { type: 'setRect', id: 'lemma', rect: { x: 0, y: 0, w: 1, h: 1 } })).toBeUndefined();
});

test('minimize targets the given window, not only the focused one', () => {
  let s = open('lemma', 'conway'); // conway focused
  s = reducer(s, { type: 'minimize', id: 'lemma', flight: null, next: 'conway' });
  expect(s.wins.find((w) => w.id === 'lemma')!.minimized).toBe(true);
  expect(s.activeId).toBe('conway');
});

test('close hands focus to the next window', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'close', id: 'conway', flight: null, next: 'lemma' });
  expect(s.activeId).toBe('lemma');
});

test('focusing or launching another window leaves full-stage mode', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'toggleExpand' });
  s = reducer(s, { type: 'focus', id: 'lemma' });
  expect(s.expanded).toBe(false);
  s = reducer(s, { type: 'toggleExpand' });
  s = reducer(s, { type: 'launch', id: 'wishy', flight: null });
  expect(s.expanded).toBe(false);
});

test('reorder rearranges tabs (and so screens) in the given order', () => {
  let s = open('lemma', 'synthesis', 'conway');
  s = reducer(s, { type: 'reorder', order: ['conway', 'lemma', 'synthesis'] });
  expect(tabIds(s)).toEqual(['conway', 'lemma', 'synthesis']);
  expect(s.activeId).toBe('conway');
});

test('reorder ignores ids that are not open and keeps unlisted windows at the end', () => {
  let s = open('lemma', 'synthesis', 'conway');
  s = reducer(s, { type: 'reorder', order: ['wishy', 'synthesis'] });
  expect(tabIds(s)).toEqual(['synthesis', 'lemma', 'conway']);
});
