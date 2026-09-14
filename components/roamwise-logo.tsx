/** Shared vector identity for the website and both trip viewers. */
export function RoamwiseLogo({ className = 'size-8' }: { className?: string }) {
  return <img src="/roamwise.svg" alt="" aria-hidden="true" width={32} height={32} className={`shrink-0 ${className}`} />;
}
