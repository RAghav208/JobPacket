import { parseCvBuffer } from "@/lib/cv/parse";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — resumes are tiny; reject anything huge.

/**
 * POST /api/parse-cv — multipart upload of a resume file → extracted text.
 * Errors are returned structured, never thrown to a 500.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, reason: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, reason: "too_large" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseCvBuffer(buffer, file.name, file.type);
    return Response.json({ ok: true, text, filename: file.name });
  } catch (e) {
    return Response.json({ ok: false, reason: "parse_failed", message: (e as Error).message });
  }
}
