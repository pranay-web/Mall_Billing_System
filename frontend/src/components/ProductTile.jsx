import { productIcon, showroomMeta } from '../lib/catalogMeta.js';

/** Tinted square tile with the product's (or showroom's) icon. */
export function ProductTile({ item, size = 'md' }) {
  const Icon = productIcon(item);
  const { tile } = showroomMeta(item?.showroomId);
  const dims = size === 'sm' ? 'size-9 rounded-xl [&>svg]:size-4' : size === 'lg' ? 'size-14 rounded-2xl [&>svg]:size-6' : 'size-11 rounded-xl [&>svg]:size-5';
  return (
    <div className={`grid shrink-0 place-items-center ring-1 ring-inset ${tile} ${dims}`}>
      <Icon strokeWidth={1.9} aria-hidden />
    </div>
  );
}

export function ShowroomIcon({ showroomId, className = 'size-8' }) {
  const { icon: Icon, tile } = showroomMeta(showroomId);
  return (
    <div className={`grid shrink-0 place-items-center rounded-lg ring-1 ring-inset ${tile} ${className}`}>
      <Icon className="size-[55%]" strokeWidth={2} aria-hidden />
    </div>
  );
}
