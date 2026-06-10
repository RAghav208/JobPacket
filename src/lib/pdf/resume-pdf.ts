import { jsPDF } from "jspdf";

/**
 * Generate an ATS-friendly résumé PDF from the tailored résumé text.
 *
 * ATS-friendly = selectable machine-readable text (not an image), single column,
 * a standard embedded font (Helvetica), generous margins, no tables/graphics that
 * break parsers. The job's keywords are already woven into the tailored text.
 *
 * Runs in the browser (called from client onClick handlers).
 */
export interface ResumePdfParams {
  resumeText: string;
  jobTitle?: string;
  company?: string;
}

/** Build the PDF document (no browser APIs) — testable/verifiable in Node. */
export function buildResumeDoc(params: ResumePdfParams): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54; // 0.75 inch
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  const lineHeight = 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);

  // splitTextToSize wraps to width AND respects existing newlines.
  const lines: string[] = doc.splitTextToSize(params.resumeText.replace(/\r\n?/g, "\n"), maxW);

  let y = margin;
  for (const line of lines) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }
  return doc;
}

export function resumePdfFilename(params: ResumePdfParams): string {
  return `${pdfName(params.company, params.jobTitle)}.pdf`;
}

/** Trigger a browser download of the ATS-friendly résumé PDF. */
export function downloadResumePdf(params: ResumePdfParams): void {
  buildResumeDoc(params).save(resumePdfFilename(params));
}

function pdfName(company?: string, jobTitle?: string): string {
  const parts = ["JobPacket-Resume", company, jobTitle]
    .filter(Boolean)
    .map((s) => String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return parts.join("-").slice(0, 80) || "JobPacket-Resume";
}
