import { motion } from 'motion/react';
import { apps } from '../../config/apps.config';
import type { Rect } from '../../hooks/useWindowManager';
import { Icon } from '../ui/Icon';
import { RotatingGreeting } from '../ui/RotatingGreeting';
import { Squiggle } from '../ui/Squiggle';
import { AppTile } from '../ui/AppTile';

interface Props {
  hidden: boolean;
  padLeft: number;
  running: Set<string>;
  reduced: boolean;
  onLaunch: (id: string, origin: Rect) => void;
}

const PROMPT = 'Which app are you opening today?';

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
                  color: `color-mix(in oklab, var(--brand-a), var(--brand-b) ${Math.round((i / Math.max(1, n - 1)) * 100)}%)`,
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
              <button
                key={app.id}
                type="button"
                className="app-card enter"
                style={{ '--d': `${460 + i * 60}ms` } as React.CSSProperties}
                aria-label={`Open ${app.name}: ${app.tagline}`}
                onClick={(e) => {
                  const r = e.currentTarget.querySelector('.app-card-icon')!.getBoundingClientRect();
                  onLaunch(app.id, { x: r.left, y: r.top, w: r.width, h: r.height });
                }}
              >
                <span className="app-card-icon" data-launch={`grid-${app.id}`}>
                  <AppTile id={app.id} size={64} />
                  {running.has(app.id) && <span className="app-card-dot" aria-hidden />}
                </span>
                <span className="app-card-meta">
                  <span className="app-card-title">{app.name}</span>
                  <span className="app-card-sub">{app.tagline}</span>
                </span>
                <span className="app-card-arrow" aria-hidden>
                  <Icon name="arrowUpRight" size={18} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>
    </motion.main>
  );
}
