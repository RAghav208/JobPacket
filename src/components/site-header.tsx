import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-base font-bold tracking-tight text-fg">
            JobPacket
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
            stop spraying
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/packet" className="rounded-control px-3 py-1.5 font-medium text-fg hover:bg-hover">
            Build Packet
          </Link>
          <Link href="/packets" className="rounded-control px-3 py-1.5 text-muted hover:bg-hover hover:text-fg">
            My Packets
          </Link>
          <Link href="/" className="rounded-control px-3 py-1.5 text-muted hover:bg-hover hover:text-fg">
            Quick Score
          </Link>
          <Link href="/jobs" className="rounded-control px-3 py-1.5 text-muted hover:bg-hover hover:text-fg">
            Find Jobs
          </Link>
        </nav>
      </div>
    </header>
  );
}
