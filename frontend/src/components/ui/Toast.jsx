import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CircleCheck, color: 'text-emerald-500' },
  error: { icon: CircleAlert, color: 'text-red-500' },
  warning: { icon: TriangleAlert, color: 'text-amber-500' },
  info: { icon: Info, color: 'text-brand-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    ({ tone = 'info', title, description, action, duration = tone === 'error' ? 6000 : 3500 }) => {
      const id = crypto.randomUUID?.() ?? String(Math.random());
      setToasts((list) => [...list.slice(-2), { id, tone, title, description, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[80] flex flex-col items-center gap-2 px-4 print:hidden"
        >
          {toasts.map((t) => {
            const { icon: Icon, color } = TONES[t.tone];
            return (
              <div
                key={t.id}
                role={t.tone === 'error' ? 'alert' : 'status'}
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white/95 p-3.5 shadow-lift ring-1 ring-zinc-900/5 backdrop-blur-xl animate-fade-up ${t.tone === 'error' ? 'animate-shake' : ''}`}
              >
                <Icon className={`mt-0.5 size-5 shrink-0 ${color}`} strokeWidth={2.2} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{t.description}</p>}
                </div>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand-600 transition hover:bg-brand-50"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  className="-m-0.5 shrink-0 rounded-md p-0.5 text-zinc-400 transition hover:text-zinc-700"
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx.toast;
};
