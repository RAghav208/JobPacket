/**
 * CV file parsing — turn an uploaded PDF / DOCX / TXT into plain resume text.
 *
 * Runs server-side only (unpdf + mammoth are Node libraries). The kind
 * detection and text cleanup are pure and unit-tested; the actual extraction
 * is verified against a real resume file.
 */

export type CvFileKind = "pdf" | "docx" | "txt" | "unknown";

/** Decide how to parse a file from its name and (optional) MIME type. Pure. */
export function detectKind(filename: string, mime?: string): CvFileKind {
  const name = filename.toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (name.endsWith(".pdf") || m === "application/pdf") return "pdf";
  if (
    name.endsWith(".docx") ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (name.endsWith(".txt") || m === "text/plain") return "txt";
  return "unknown";
}

/** Collapse the runaway whitespace that PDF extraction tends to produce. Pure. */
export function cleanCvText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Extract resume text from an uploaded file buffer. Throws on unsupported types. */
export async function parseCvBuffer(
  buffer: Buffer,
  filename: string,
  mime?: string,
): Promise<string> {
  const kind = detectKind(filename, mime);

  switch (kind) {
    case "txt":
      return cleanCvText(buffer.toString("utf8"));

    case "docx": {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer });
      return cleanCvText(value);
    }

    case "pdf": {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return cleanCvText(Array.isArray(text) ? text.join("\n") : text);
    }

    default:
      throw new Error("Unsupported file type. Upload a PDF, DOCX, or .txt — or paste your CV text.");
  }
}
