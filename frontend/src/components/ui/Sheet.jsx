import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet on phones, right-hand drawer from `md` up.
 * Locks body scroll, closes on Escape / backdrop, and restores focus on close.
 */
export function Sheet({ open, onClose, title, description, children, footer, initialFocusRef, wide = false }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);

    const focusTimer = setTimeout(() => {
      (initialFocusRef?.current ?? panelRef.current)?.focus({ preventScroll: true });
    }, 60);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end md:items-stretch md:justify-end print:hidden">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-lift outline-none animate-sheet-up md:max-h-none md:rounded-none md:rounded-l-[28px] md:animate-sheet-left ${wide ? 'md:w-[520px]' : 'md:w-[440px]'}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-zinc-200 md:hidden" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-4 md:px-6 md:pt-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-zinc-100 px-5 py-4 pb-safe md:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
