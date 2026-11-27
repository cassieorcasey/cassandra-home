import { motion } from 'motion/react';
import { apps } from '../../config/apps.config';
import type { Rect } from '../../hooks/useWindowManager';
import { AppIcon } from '../ui/AppIcon';
import { Squiggle } from '../ui/Squiggle';

interface Props {
  hidden: boolean;
  padLeft: number;
  running: Set<string>;
  reduced: boolean;
  onLaunch: (id: string, origin: Rect) => void;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

const ease = [0.2, 0, 0, 1] as const;

export function Launchpad({ hidden, padLeft, running, reduced, onLaunch }: Props) {
  const featured = apps.filter((a) => a.featured);
  const rest = apps.filter((a) => !a.featured);
  const rise = (i: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease, delay: 0.08 * i } };

  return (
    <motion.main
      className="launchpad"
      inert={hidden}
      aria-hidden={hidden}
      animate={{ opacity: hidden ? 0 : 1, scale: hidden && !reduced ? 0.98 : 1 }}
      transition={{ duration: 0.3, ease }}
      style={{ paddingLeft: padLeft }}
    >
      <section className="hero">
        <motion.p className="greeting" {...rise(0)}>
          {greeting()} — ini rumah semua aplikasiku.
        </motion.p>
        <motion.h1 {...rise(1)}>
          Cassandra
          <Squiggle reduced={reduced} />
        </motion.h1>
        <motion.p className="subtitle" {...rise(2)}>
          Ekosistem web app produktivitas. Ketuk ikon untuk langsung mencobanya di sini.
        </motion.p>
      </section>

      <motion.section className="featured-row" aria-label="Aplikasi unggulan" {...rise(3)}>
        {featured.map((app) => (
          <motion.button
            key={app.id}
            type="button"
            className="featured-card glass"
            whileHover={reduced ? undefined : { y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              const r = e.currentTarget.querySelector('[data-squircle]')!.getBoundingClientRect();
              onLaunch(app.id, { x: r.left, y: r.top, w: r.width, h: r.height });
            }}
          >
            <span className="squircle" data-squircle data-launch={`grid-${app.id}`} style={{ width: 64, height: 64 }}>
              <img src={app.icon} alt="" width={64} height={64} />
            </span>
            <span className="featured-text">
              <span className="featured-name">{app.name}</span>
              <span className="featured-tag">{app.tagline}</span>
            </span>
            {running.has(app.id) && <span className="run-dot" aria-label="sedang terbuka" />}
          </motion.button>
        ))}
      </motion.section>

      <motion.section className="app-grid" aria-label="Semua aplikasi" {...rise(4)}>
        {rest.map((app) => (
          <AppIcon
            key={app.id}
            app={app}
            size={72}
            launchKey={`grid-${app.id}`}
            running={running.has(app.id)}
            onLaunch={(r) => onLaunch(app.id, r)}
          />
        ))}
      </motion.section>
    </motion.main>
  );
}
