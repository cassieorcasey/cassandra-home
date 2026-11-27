import { motion } from 'motion/react';
import { apps } from '../../config/apps.config';
import type { Rect } from '../../hooks/useWindowManager';
import { RotatingGreeting } from '../ui/RotatingGreeting';
import { Squiggle } from '../ui/Squiggle';
import { SpaceCard } from './SpaceCard';

interface Props {
  hidden: boolean;
  padLeft: number;
  running: Set<string>;
  reduced: boolean;
  onLaunch: (id: string, origin: Rect) => void;
}

const PROMPT = 'Which app are you opening today?';

/** Warna gradasi wordmark di posisi t (0..1): --brand-a → --brand-m (55%) → --brand-b. */
function gradientAt(t: number) {
  const M = 0.55;
  return t <= M
    ? `color-mix(in oklab, var(--brand-a), var(--brand-m) ${Math.round((t / M) * 100)}%)`
    : `color-mix(in oklab, var(--brand-m), var(--brand-b) ${Math.round(((t - M) / (1 - M)) * 100)}%)`;
}

/** Teks dipecah per huruf untuk animasi masuk; pembaca layar membaca teks utuh. */
function Split({ text, delay = 160, gradient = false }: { text: string; delay?: number; gradient?: boolean }) {
  const n = [...text].length;
  return (
    <>
      <span className="split" aria-hidden>
        {[...text].map((c, i) => (
          <span
            key={i}
            className="ch"
            style={
              {
                '--i': i,
                '--d0': `${delay}ms`,
                // gradasi per huruf: tetap utuh selama tiap huruf beranimasi sendiri-sendiri
                ...(gradient && {
                  color: gradientAt(i / Math.max(1, n - 1)),
                }),
              } as React.CSSProperties
            }
          >
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

export function Launchpad({ hidden, padLeft, running, reduced, onLaunch }: Props) {
  // fitur unggulan di depan, sisanya mengikuti urutan registri
  const ordered = [...apps.filter((a) => a.featured), ...apps.filter((a) => !a.featured)];

  return (
    <motion.main
      className="launchpad"
      inert={hidden}
      aria-hidden={hidden}
      animate={{ opacity: hidden ? 0 : 1, scale: hidden && !reduced ? 0.98 : 1 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      style={{ paddingLeft: padLeft }}
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
              <SpaceCard key={app.id} app={app} index={i} running={running.has(app.id)} onLaunch={onLaunch} />
            ))}
          </div>
        </section>
      </section>
    </motion.main>
  );
}
