import { motion } from 'motion/react';
import { apps } from '../../config/apps.config';
import type { Rect } from '../../hooks/useWindowManager';
import { Icon } from '../ui/Icon';
import { RotatingGreeting } from '../ui/RotatingGreeting';
import { Squiggle } from '../ui/Squiggle';

interface Props {
  hidden: boolean;
  padLeft: number;
  running: Set<string>;
  reduced: boolean;
  onLaunch: (id: string, origin: Rect) => void;
}

const PROMPT = 'Which app are you opening today?';

/** Teks dipecah per huruf untuk animasi masuk; pembaca layar membaca teks utuh. */
function Split({ text, delay = 160 }: { text: string; delay?: number }) {
  return (
    <>
      <span className="split" aria-hidden>
        {[...text].map((c, i) => (
          <span key={i} className="ch" style={{ '--i': i, '--d0': `${delay}ms` } as React.CSSProperties}>
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

        <h1 className="title">
          <span className="title-word">
            <Split text="Cassandra" />
            <Squiggle reduced={reduced} />
          </span>
        </h1>

        <p className="prompt" lang="en">
          <Split text={PROMPT} delay={420} />
        </p>

        <section className="quick-apps" aria-labelledby="quick-apps-label">
          <p id="quick-apps-label" className="quick-apps-label enter" style={{ '--d': '420ms' } as React.CSSProperties}>
            Aplikasi
          </p>
          <div className="quick-apps-grid">
            {ordered.map((app, i) => (
              <button
                key={app.id}
                type="button"
                className="app-card enter"
                style={{ '--d': `${460 + i * 60}ms` } as React.CSSProperties}
                aria-label={`Buka ${app.name}: ${app.tagline}`}
                onClick={(e) => {
                  const r = e.currentTarget.querySelector('.app-card-icon')!.getBoundingClientRect();
                  onLaunch(app.id, { x: r.left, y: r.top, w: r.width, h: r.height });
                }}
              >
                <span className="app-card-icon" data-launch={`grid-${app.id}`}>
                  <img src={app.icon} alt="" width={44} height={44} draggable={false} />
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
