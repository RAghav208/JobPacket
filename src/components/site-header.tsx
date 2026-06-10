import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-base font-bold tracking-tight text-fg">
            JobPacket
          </span>
          <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint sm:inline">
            stop spraying
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-0.5 text-sm sm:gap-1">
          <Link href="/packet" className="rounded-control px-2 py-1.5 font-medium text-fg hover:bg-hover sm:px-3">
            Build Packet
          </Link>
          <Link href="/packets" className="rounded-control px-2 py-1.5 text-muted hover:bg-hover hover:text-fg sm:px-3">
            My Packets
          </Link>
          <Link href="/" className="rounded-control px-2 py-1.5 text-muted hover:bg-hover hover:text-fg sm:px-3">
            Quick Score
          </Link>
          <Link href="/jobs" className="rounded-control px-2 py-1.5 text-muted hover:bg-hover hover:text-fg sm:px-3">
            Find Jobs
          </Link>
        </nav>
      </div>
    </header>
  );
}
