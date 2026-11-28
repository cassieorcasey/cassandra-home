import { motion } from 'motion/react';
import { Fragment } from 'react';
import { apps } from '../../config/apps.config';
import { WINDOW_MORPH } from '../../config/motion';
import type { AppId } from '../../types/os';
import { RotatingGreeting } from '../ui/RotatingGreeting';
import { Squiggle } from '../ui/Squiggle';
import { SpaceCard } from './SpaceCard';

/**
 * Keadaan Launchpad di belakang jendela:
 * - 'none': tampil penuh (tidak ada jendela aktif).
 * - 'dim': redup tipis (0.65, skala 0.98) selama morph membuka, memberi fokus ke jendela.
 * - 'away': tersembunyi setelah jendela mendarat, supaya tidak bertabrakan dengan
 *   jendela desktop yang ukurannya diubah.
 */
export type LaunchpadDim = 'none' | 'dim' | 'away';

interface Props {
  dim: LaunchpadDim;
  /** Multitask Bar tampil di bawah: Home menyisakan ruang untuknya. */
  barShown: boolean;
  running: Set<string>;
  reduced: boolean;
  onLaunch: (id: AppId) => void;
  registerTile: (id: AppId, el: HTMLElement | null) => void;
}

const PROMPT = 'Which app are you opening today?';

/** Warna gradasi wordmark di posisi t (0..1): --brand-a → --brand-m (55%) → --brand-b. */
function gradientAt(t: number) {
  const M = 0.55;
  return t <= M
    ? `color-mix(in oklab, var(--brand-a), var(--brand-m) ${Math.round((t / M) * 100)}%)`
    : `color-mix(in oklab, var(--brand-m), var(--brand-b) ${Math.round(((t - M) / (1 - M)) * 100)}%)`;
}

/**
 * Teks dipecah per huruf untuk animasi masuk; pembaca layar membaca teks utuh.
 * Huruf dikelompokkan per kata (.split-word, nowrap) sehingga baris hanya boleh patah di
 * spasi antarkata, bukan di antara dua huruf inline-block (dulu "toda / y?" di 320 px).
 * Indeks --i tetap dihitung atas seluruh teks (spasi ikut) agar urutan animasi tidak berubah.
 */
function Split({ text, delay = 160, gradient = false }: { text: string; delay?: number; gradient?: boolean }) {
  const chars = [...text];
  const n = chars.length;
  const words: { start: number; chars: string[] }[] = [];
  chars.forEach((c, i) => {
    if (c === ' ') return;
    const last = words[words.length - 1];
    if (last && last.start + last.chars.length === i) last.chars.push(c);
    else words.push({ start: i, chars: [c] });
  });
  return (
    <>
      <span className="split" aria-hidden>
        {words.map((w, wi) => (
          <Fragment key={w.start}>
            {wi > 0 && ' '}
            <span className="split-word">
              {w.chars.map((c, j) => {
                const i = w.start + j;
                return (
                  <span
                    key={i}
                    className="ch"
                    style={
                      {
                        '--i': i,
                        '--d0': `${delay}ms`,
                        // gradasi per huruf: tetap utuh selama tiap huruf beranimasi sendiri-sendiri
                        ...(gradient && { color: gradientAt(i / Math.max(1, n - 1)) }),
                      } as React.CSSProperties
                    }
                  >
                    {c}
                  </span>
                );
              })}
            </span>
          </Fragment>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

export function Launchpad({ dim, barShown, running, reduced, onLaunch, registerTile }: Props) {
  const hidden = dim !== 'none';
  // fitur unggulan di depan, sisanya mengikuti urutan registri
  const ordered = [...apps.filter((a) => a.featured), ...apps.filter((a) => !a.featured)];

  return (
    <motion.main
      className={barShown ? 'launchpad has-bar' : 'launchpad'}
      inert={hidden}
      aria-hidden={hidden}
      animate={{ opacity: dim === 'away' ? 0 : dim === 'dim' ? 0.65 : 1, scale: hidden && !reduced ? 0.98 : 1 }}
      // kembali (tutup) secepat morph tutup agar kartu sudah di skala 1 saat proxy mendarat
      transition={
        reduced
          ? { duration: WINDOW_MORPH.reducedFadeMs / 1000 }
          : { duration: (hidden ? WINDOW_MORPH.openMs : WINDOW_MORPH.closeMs) / 1000, ease: [0.2, 0, 0, 1] }
      }
    >
      <section className="hero">
        <p className="greeting enter" style={{ '--d': '60ms' } as React.CSSProperties}>
          <RotatingGreeting paused={hidden} reduced={reduced} />
        </p>

        {/* seperti referensi: kedua bagian masuk bersamaan per huruf, rapat dari renggang */}
        <h1 className="title" aria-label="cassandra.suite">
          <span className="title-word">
            <Split text="cassandra" gradient />
            <Squiggle reduced={reduced} />
          </span>
          <span className="title-suffix">
            <Split text=".suite" />
          </span>
        </h1>

        <p className="prompt" lang="en">
          <Split text={PROMPT} delay={420} />
        </p>

        <section className="quick-apps" aria-labelledby="quick-apps-label" lang="en">
          <p id="quick-apps-label" className="quick-apps-label enter" style={{ '--d': '420ms' } as React.CSSProperties}>
            Spaces
          </p>
          <div className="quick-apps-grid">
            {ordered.map((app, i) => (
              <SpaceCard
                key={app.id}
                app={app}
                index={i}
                running={running.has(app.id)}
                onLaunch={onLaunch}
                registerTile={registerTile}
              />
            ))}
          </div>
        </section>
      </section>
    </motion.main>
  );
}
