import type { AppId, CassandraApp } from '../types/os';

export type { CassandraApp } from '../types/os';

const base = 'https://cassieorcasey.github.io';

export const apps: CassandraApp[] = [
  {
    id: 'lemma',
    name: 'Lemma',
    tagline: 'Learning notebook: what did you understand today?',
    category: 'App',
    url: `${base}/lemma/`,
    embedMode: 'iframe',
    featured: true,
  },
  {
    id: 'synthesis',
    name: 'Synthesis',
    tagline: 'A connected map of your study materials.',
    category: 'App',
    url: `${base}/synthesis/`,
    embedMode: 'iframe',
    featured: true,
  },
  {
    id: 'conway',
    name: 'Conway',
    tagline: 'Roadmap to Lead Data Scientist.',
    category: 'Tool',
    url: `${base}/conway/`,
    embedMode: 'iframe',
  },
  {
    id: 'subset',
    name: 'Subset',
    tagline: 'Envelope budgets for every spending category.',
    category: 'Tool',
    url: `${base}/subset/`,
    embedMode: 'iframe',
  },
  {
    id: 'wishy',
    name: 'Wishy',
    tagline: 'Shopping wishlist board.',
    category: 'Tool',
    url: `${base}/wishy/`,
    embedMode: 'iframe',
  },
];

export const appById = (id: AppId) => apps.find((a) => a.id === id)!;
