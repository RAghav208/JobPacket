import { describe, it, expect } from "vitest";
import { detectKind, cleanCvText, parseCvBuffer } from "./parse";

describe("detectKind", () => {
  it("detects by extension", () => {
    expect(detectKind("resume.pdf")).toBe("pdf");
    expect(detectKind("resume.docx")).toBe("docx");
    expect(detectKind("resume.txt")).toBe("txt");
    expect(detectKind("resume.rtf")).toBe("unknown");
  });

  it("detects by MIME when the name is unhelpful", () => {
    expect(detectKind("blob", "application/pdf")).toBe("pdf");
    expect(detectKind("blob", "text/plain")).toBe("txt");
  });
});

describe("cleanCvText", () => {
  it("collapses runaway whitespace and trims lines", () => {
    expect(cleanCvText("  Python   Developer  \n\n\n\n  Bengaluru ")).toBe(
      "Python Developer\n\nBengaluru",
    );
  });

  it("normalizes carriage returns", () => {
    expect(cleanCvText("a\r\nb")).toBe("a\nb");
  });
});

describe("parseCvBuffer", () => {
  it("parses a .txt buffer", async () => {
    const text = await parseCvBuffer(Buffer.from("Python and SQL.\n\n\n"), "cv.txt");
    expect(text).toBe("Python and SQL.");
  });

  it("rejects unsupported types with a helpful message", async () => {
    await expect(parseCvBuffer(Buffer.from("x"), "cv.rtf")).rejects.toThrow(/Unsupported/);
  });
});
