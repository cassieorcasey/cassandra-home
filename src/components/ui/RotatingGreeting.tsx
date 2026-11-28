import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { usePerfLite } from '../../hooks/usePerfLite';

const GREETINGS: { text: string; lang: string }[] = [
  { text: 'Selamat datang di', lang: 'id' },
  { text: 'Welcome to', lang: 'en' },
  { text: 'ようこそ', lang: 'ja' },
  { text: 'Bienvenue à', lang: 'fr' },
  { text: '환영합니다', lang: 'ko' },
  { text: 'Willkommen bei', lang: 'de' },
  { text: 'Bienvenido a', lang: 'es' },
  { text: '欢迎来到', lang: 'zh' },
  { text: 'Benvenuto a', lang: 'it' },
];
const INTERVAL = 2600;

/**
 * Sapaan yang naik keluar lalu digantikan bahasa berikutnya dari bawah.
 * Pembaca layar hanya membaca versi Indonesia sekali (tidak diumumkan tiap ganti).
 */
export function RotatingGreeting({ paused, reduced }: { paused: boolean; reduced: boolean }) {
  const [i, setI] = useState(0);
  const lite = usePerfLite(); // perangkat lambat: sapaan berhenti di bahasa yang sedang tampil

  useEffect(() => {
    if (paused || reduced || lite) return;
    const t = window.setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % GREETINGS.length);
    }, INTERVAL);
    return () => clearInterval(t);
  }, [paused, reduced, lite]);

  const g = GREETINGS[reduced ? 0 : i];
  return (
    <span className="greeting-rotor">
      <span className="sr-only">{GREETINGS[0].text}</span>
      {/* kata lama dan baru bertumpuk di sel grid yang sama: tanpa popLayout, tanpa ukur ulang tata letak */}
      <AnimatePresence initial={false}>
        <motion.span
          key={g.lang}
          lang={g.lang}
          className="greeting-word"
          aria-hidden
          initial={{ opacity: 0, y: '0.9em' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '-0.9em' }}
          transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
        >
          {g.text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
