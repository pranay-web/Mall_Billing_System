import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

const TONES = {
  info: { box: 'bg-brand-50/70 border-brand-200/70 text-brand-900', icon: Info, iconColor: 'text-brand-500' },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: CircleCheck, iconColor: 'text-emerald-500' },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: TriangleAlert, iconColor: 'text-amber-500' },
  error: { box: 'bg-red-50 border-red-200 text-red-900', icon: CircleAlert, iconColor: 'text-red-500' },
};

export function Alert({ tone = 'info', title, children, action, onDismiss, className = '' }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border p-3.5 text-sm animate-fade-up ${t.box} ${className}`}>
      <Icon className={`mt-px size-[18px] shrink-0 ${t.iconColor}`} strokeWidth={2.2} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-5">{title}</p>}
        {children && <div className={`leading-relaxed opacity-85 ${title ? 'mt-0.5' : ''}`}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="-m-1 h-fit rounded-md p-1 opacity-50 transition hover:bg-black/5 hover:opacity-100" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
