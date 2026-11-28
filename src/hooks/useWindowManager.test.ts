import { expect, test } from 'vitest';
import { initial, reducer, tabIds } from './useWindowManager';

const open = (...ids: Parameters<typeof tabIds>[0]['activeId'][]) =>
  ids.reduce((s, id) => reducer(s, { type: 'launch', id: id!, flight: null }), initial);

test('tabs follow open order and survive minimize', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'minimize', flight: null });
  expect(tabIds(s)).toEqual(['lemma', 'conway']);
  expect(s.activeId).toBeNull();
  expect(s.wins.find((w) => w.id === 'conway')!.minimized).toBe(true);
});

test('focus restores a minimized tab without reordering', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'minimize', flight: null });
  s = reducer(s, { type: 'focus', id: 'lemma' });
  expect(s.activeId).toBe('lemma');
  expect(tabIds(s)).toEqual(['lemma', 'conway']);
});

test('close removes the tab', () => {
  let s = open('lemma', 'conway');
  s = reducer(s, { type: 'close', id: 'conway', flight: null });
  expect(tabIds(s)).toEqual(['lemma']);
  expect(s.activeId).toBeNull();
});

test('state has no deck', () => {
  expect('deck' in initial).toBe(false);
});
