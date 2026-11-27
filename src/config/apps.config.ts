export interface CassandraApp {
  id: string;
  name: string;
  tagline: string;
  category: 'App' | 'Tool' | 'Social' | 'Experiment';
  url: string;
  embedMode: 'iframe' | 'preview-card';
  icon: string;
  featured?: boolean;
}

const base = 'https://cassieorcasey.github.io';

export const apps: CassandraApp[] = [
  {
    id: 'lemma',
    name: 'Lemma',
    tagline: 'Catatan hasil belajar: apa yang kamu pahami hari ini?',
    category: 'App',
    url: `${base}/lemma/`,
    embedMode: 'iframe',
    icon: `${import.meta.env.BASE_URL}icons/lemma.webp`,
    featured: true,
  },
  {
    id: 'synthesis',
    name: 'Synthesis',
    tagline: 'Peta materi belajar yang saling terhubung.',
    category: 'App',
    url: `${base}/synthesis/`,
    embedMode: 'iframe',
    icon: `${import.meta.env.BASE_URL}icons/synthesis.webp`,
    featured: true,
  },
  {
    id: 'conway',
    name: 'Conway',
    tagline: 'Roadmap menuju Lead Data Scientist.',
    category: 'Tool',
    url: `${base}/conway/`,
    embedMode: 'iframe',
    icon: `${import.meta.env.BASE_URL}icons/conway.webp`,
  },
  {
    id: 'subset',
    name: 'Subset',
    tagline: 'Budget amplop untuk tiap kategori pengeluaran.',
    category: 'Tool',
    url: `${base}/subset/`,
    embedMode: 'iframe',
    icon: `${import.meta.env.BASE_URL}icons/subset.webp`,
  },
  {
    id: 'wishy',
    name: 'Wishy',
    tagline: 'Papan wishlist belanja.',
    category: 'Tool',
    url: `${base}/wishy/`,
    embedMode: 'iframe',
    icon: `${import.meta.env.BASE_URL}icons/wishy.webp`,
  },
];

export const appById = (id: string) => apps.find((a) => a.id === id)!;
