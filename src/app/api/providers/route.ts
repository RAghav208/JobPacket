import { listProviderInfo } from "@/lib/provider-registry";

/**
 * GET /api/providers — the AI agents/keys JobPacket detected on this machine,
 * in preference order, for the UI picker. Detection is cached (~60s).
 */
export async function GET() {
  try {
    const providers = await listProviderInfo();
    return Response.json({ providers });
  } catch (e) {
    return Response.json({ providers: [], error: (e as Error).message });
  }
}
