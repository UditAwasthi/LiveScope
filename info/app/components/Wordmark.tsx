type Props = { size?: 'nav' | 'hero' | 'footer'; chrome?: boolean; className?: string };

const sizes = {
  nav: { text: 'text-[22px]', dot: 'h-[6px] w-[6px] ml-[3px]' },
  hero: { text: 'text-[64px] md:text-[96px]', dot: 'h-[11px] w-[11px] ml-[8px]' },
  footer: { text: 'text-[64px] md:text-[112px]', dot: 'h-[12px] w-[12px] ml-[8px]' },
} as const;

/** "LiveScope" in Lora with a single accent dot as the mark. `chrome` gives it a machined finish. */
export function Wordmark({ size = 'nav', chrome = false, className = '' }: Props) {
  const s = sizes[size];
  return (
    <span className={`inline-flex items-baseline font-serif leading-none tracking-[-0.02em] ${s.text} ${className}`}>
      <span className={chrome ? 'chrome-text' : 'text-ink'}>LiveScope</span>
      <span aria-hidden className={`inline-block rounded-full bg-accent ${s.dot}`} style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }} />
    </span>
  );
}
