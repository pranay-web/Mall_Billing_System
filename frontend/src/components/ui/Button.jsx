import { Spinner } from './misc.jsx';

const VARIANTS = {
  primary:
    'bg-brand-500 text-white shadow-brand hover:bg-brand-600 active:bg-brand-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none',
  secondary:
    'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 shadow-card hover:bg-zinc-50 hover:ring-zinc-300 active:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-white',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200/70 disabled:text-zinc-300',
  success:
    'bg-emerald-500 text-white shadow-success hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none',
  dark: 'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400',
  danger: 'bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 active:bg-red-100',
  glass: 'bg-white/15 text-white ring-1 ring-inset ring-white/25 backdrop-blur-md hover:bg-white/25 active:bg-white/30',
};

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
  xl: 'h-14 gap-2.5 rounded-2xl px-6 text-base',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}) {
  const iconSize = size === 'sm' || size === 'icon-sm' ? 'size-3.5' : size === 'xl' ? 'size-5' : 'size-4';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 select-none items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Spinner className={iconSize} /> : Icon ? <Icon className={iconSize} strokeWidth={2.2} aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight className={iconSize} strokeWidth={2.2} aria-hidden /> : null}
    </button>
  );
}
