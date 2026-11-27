import type { CassandraApp, Rect } from '../../types/os';
import { AppTile } from '../ui/AppTile';
import { Icon } from '../ui/Icon';

/**
 * Kartu SPACES berbentuk objek metaforis.
 * Semua siluet digambar di kanvas 320×148. Kartu dikunci ke rasio yang sama (aspect-ratio),
 * jadi SVG selalu diskalakan seragam: lengkung tidak lonjong, lubang tidak gepeng.
 */
export const W = 320;
export const H = 148;

type Pt = [x: number, y: number, r: number];

/** Poligon dengan tiap sudut dibulatkan (busur lingkaran, radius dibatasi setengah sisi terpendek). */
function roundPoly(pts: Pt[]) {
  const n = pts.length;
  let d = '';
  pts.forEach(([x, y, r], i) => {
    const [px, py] = pts[(i - 1 + n) % n];
    const [nx, ny] = pts[(i + 1) % n];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    // jarak potong dari sudut agar busur bersinggungan dengan kedua sisi
    const a1 = Math.atan2(py - y, px - x);
    const a2 = Math.atan2(ny - y, nx - x);
    let th = Math.abs(a1 - a2);
    if (th > Math.PI) th = 2 * Math.PI - th;
    const t = Math.min(r / Math.tan(th / 2), l1 / 2, l2 / 2);
    const rr = t * Math.tan(th / 2);
    const sx = x + ((px - x) / l1) * t;
    const sy = y + ((py - y) / l1) * t;
    const ex = x + ((nx - x) / l2) * t;
    const ey = y + ((ny - y) / l2) * t;
    const cross = (x - px) * (ny - y) - (y - py) * (nx - x);
    const f = (v: number) => +v.toFixed(2);
    d += `${i === 0 ? 'M' : 'L'}${f(sx)} ${f(sy)}A${f(rr)} ${f(rr)} 0 0 ${cross > 0 ? 1 : 0} ${f(ex)} ${f(ey)}`;
  });
  return d + 'Z';
}

/** Lingkaran sebagai subpath, untuk lubang (fill-rule evenodd). */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

interface Shape {
  /** kontur kartu; fill-rule evenodd sehingga subpath kedua menjadi lubang */
  body: string;
  /** bagian yang ikut masker kaca tetapi digambar terpisah (tutup amplop) */
  extraMask?: string;
  /** zona aman konten dalam satuan kanvas: atas, kanan, bawah, kiri */
  pad: [number, number, number, number];
}

// Lemma: kartu indeks, tiga sudut 18, kanan atas terpotong diagonal yang sedikit melengkung
const LEMMA_BODY =
  'M0 18A18 18 0 0 1 18 0H264C272 0 276 2 281 7C294 17 304 27 313 39C318 45 320 48 320 56V130A18 18 0 0 1 302 148H18A18 18 0 0 1 0 130Z';
const LEMMA_FLAP = 'M281 7C294 17 304 27 313 39C305 44 295 46 284 46Q276 46 276 38C276 26 277 16 281 7Z';

// Synthesis: kerikil simpul, perpaduan squircle dan pil stadion; sisi atas-bawah menggembung lembut
const SYN_BODY =
  'M62 6C130 -1 190 -1 258 6C298 10 316 40 316 74C316 108 298 138 258 142C190 149 130 149 62 142C22 138 4 108 4 74C4 40 22 10 62 6Z';

// Conway: tangga polyomino tiga undakan, tepi atas dan bawah sama-sama menanjak ke kanan atas
const CONWAY_BODY = roundPoly([
  [0, 28, 16], [106, 28, 7], [106, 14, 7], [213, 14, 7], [213, 0, 7], [320, 0, 16],
  [320, 120, 16], [213, 120, 7], [213, 134, 7], [106, 134, 7], [106, 148, 7], [0, 148, 16],
]);

// Subset: badan amplop + tutup trapesium tumpul
const SUBSET_BODY = roundPoly([[0, 20, 18], [320, 20, 18], [320, 148, 18], [0, 148, 18]]);
// alas tutup tepat di garis atas badan (y 20), jadi keduanya terbaca sebagai satu amplop dengan garis lipat
const SUBSET_FLAP = roundPoly([[10, 20, 0], [72, 1, 10], [248, 1, 10], [310, 20, 0]]);

// Wishy: label gantung; kiri persegi tumpul, kanan menyempit simetris ke ujung tumpul, lubang tali tembus
const EYELET = { cx: 288, cy: 74, r: 7 };
const WISHY_BODY =
  roundPoly([[0, 0, 18], [250, 0, 16], [318, 62, 10], [318, 86, 10], [250, 148, 16], [0, 148, 18]]) +
  circle(EYELET.cx, EYELET.cy, EYELET.r);

export const SHAPES: Record<CassandraApp['id'], Shape> = {
  lemma: { body: LEMMA_BODY, pad: [22, 30, 20, 20] },
  synthesis: { body: SYN_BODY, pad: [20, 30, 20, 26] },
  conway: { body: CONWAY_BODY, pad: [32, 26, 32, 20] },
  subset: { body: SUBSET_BODY, extraMask: SUBSET_FLAP, pad: [54, 22, 16, 20] },
  wishy: { body: WISHY_BODY, pad: [18, 52, 18, 20] },
};

/** Masker kaca: siluet yang sama sebagai data URI, supaya blur latar ikut kontur (termasuk lubang). */
function maskOf(s: Shape) {
  const paths = [s.body, s.extraMask].filter(Boolean).map((d) => `<path d='${d}' fill-rule='evenodd'/>`).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'>${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const MASKS = Object.fromEntries(Object.entries(SHAPES).map(([k, s]) => [k, maskOf(s)])) as Record<
  CassandraApp['id'],
  string
>;

interface Props {
  app: CassandraApp;
  index: number;
  running: boolean;
  onLaunch: (id: string, origin: Rect) => void;
}

export function SpaceCard({ app, index, running, onLaunch }: Props) {
  const id = app.id;
  const s = SHAPES[id];
  const [pt, pr, pb, pl] = s.pad;
  const g = `sc-${id}`; // id gradasi unik per kartu

  return (
    <button
      type="button"
      className="app-card enter"
      data-shape={id}
      style={
        {
          '--d': `${460 + index * 60}ms`,
          '--pt': pt,
          '--pr': pr,
          '--pb': pb,
          '--pl': pl,
          '--eye-x': `${(EYELET.cx / W) * 100}%`,
          '--eye-y': `${(EYELET.cy / H) * 100}%`,
        } as React.CSSProperties
      }
      aria-label={`Open ${app.name}: ${app.tagline}`}
      onClick={(e) => {
        const r = e.currentTarget.querySelector('.app-card-icon')!.getBoundingClientRect();
        onLaunch(id, { x: r.left, y: r.top, w: r.width, h: r.height });
      }}
    >
      {/* lapisan 1: kaca buram, dipotong mengikuti kontur lewat mask (bukan clip-path) */}
      <span className="card-glass" style={{ maskImage: MASKS[id], WebkitMaskImage: MASKS[id] }} aria-hidden />

      {/* lapisan 2: kontur, garis tepi, bayangan drop-shadow, dan ornamen */}
      <svg className="card-shape" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          {id === 'lemma' && (
            <linearGradient id={`${g}-flap`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f8fb" />
              <stop offset="1" stopColor="#b9cbd6" />
            </linearGradient>
          )}
          {id === 'subset' && (
            <linearGradient id={`${g}-fold`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#b6a1e0" />
              <stop offset="0.5" stopColor="#c9b9ea" />
              <stop offset="1" stopColor="#9fdcc3" />
            </linearGradient>
          )}
        </defs>

        <path className="card-fill" d={s.body} fillRule="evenodd" />

        {id === 'lemma' && <path className="card-flap" d={LEMMA_FLAP} fill={`url(#${g}-flap)`} />}

        {id === 'synthesis' && (
          <>
            <circle className="syn-ring syn-l" cx="4" cy="74" r="5" />
            <circle className="syn-ring syn-r" cx="316" cy="74" r="5" />
            <circle className="syn-dot syn-l" cx="4" cy="74" r="5" />
            <circle className="syn-dot syn-r" cx="316" cy="74" r="5" />
          </>
        )}

        {id === 'subset' && (
          <>
            <path className="card-fill env-flap" d={SUBSET_FLAP} />
            <path className="env-fold" d="M26 30L160 46L294 30" stroke={`url(#${g}-fold)`} />
          </>
        )}
      </svg>

      {/* Conway: kilau di atas permukaan, tetap dipotong kontur yang sama */}
      {id === 'conway' && (
        <span className="card-sheen" style={{ maskImage: MASKS[id], WebkitMaskImage: MASKS[id] }} aria-hidden>
          <span className="card-shimmer" />
        </span>
      )}

      {/* lapisan 3: konten di zona aman */}
      <span className="app-card-body">
        <span className="app-card-icon" data-launch={`grid-${id}`}>
          <AppTile id={id} size={64} />
          {running && <span className="app-card-dot" aria-hidden />}
        </span>
        <span className="app-card-meta">
          <span className="app-card-title">{app.name}</span>
          <span className="app-card-sub">{app.tagline}</span>
        </span>
        <span className="app-card-arrow" aria-hidden>
          <Icon name="arrowUpRight" size={18} />
        </span>
      </span>
    </button>
  );
}
