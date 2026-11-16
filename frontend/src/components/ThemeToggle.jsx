import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme.js';

/** Sun / moon switch shown in every header. */
export function ThemeToggle({ className = '' }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 ${className}`}
    >
      {dark ? <Sun className="size-4" strokeWidth={2.2} /> : <Moon className="size-4" strokeWidth={2.2} />}
    </button>
  );
}
