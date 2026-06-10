import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only native/IO libs: keep them external so they aren't bundled for
  // the client (PDF/DOCX parsers, and the Python subprocess bridge later).
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
