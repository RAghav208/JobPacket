import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted">That page doesn&rsquo;t exist.</p>
      <Link href="/packet">
        <Button>Build a packet →</Button>
      </Link>
    </div>
  );
}
