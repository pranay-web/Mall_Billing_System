/** Fixed action bar that sits just above the mobile tab bar. */
export function MobileActionBar({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 md:hidden print:hidden">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
