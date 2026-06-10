import { describe, it, expect } from "vitest";
import { buildPacket, packetToMarkdown } from "./packet";
import { buildCoverLetterPrompt } from "./cover-letter";
import type { JobPosting } from "../job-sources/types";
import type { ChatProvider, ChatMessage } from "../provider-registry/types";

const JOB: JobPosting = {
  sourceId: "naukri",
  externalId: "x1",
  title: "Data Scientist",
  company: "Acme",
  location: "Bengaluru",
  description: "Need Python and Machine Learning and Deep Learning.",
  url: "https://naukri.com/x1",
};

/** Fake provider whose reply depends on whether it's the cover-letter prompt. */
function smartFake(): ChatProvider {
  return {
    id: "ollama",
    label: "fake",
    complete: async (messages: ChatMessage[]) => {
      const isCover = messages.some((m) => m.content.includes("cover letter"));
      return isCover
        ? "Dear Acme, I am excited to apply..."
        : "Python, Machine Learning and Deep Learning expert.";
    },
  };
}

describe("buildCoverLetterPrompt", () => {
  const [system, user] = buildCoverLetterPrompt("Python dev.", JOB);
  it("forbids invention and names the company", () => {
    expect(system?.content.toLowerCase()).toContain("never invent");
    expect(user?.content).toContain("Acme");
  });
});

describe("buildPacket", () => {
  it("assembles tailored resume, scores, and cover letter", async () => {
    const cv = "Python developer who builds neural nets.";
    const packet = await buildPacket(cv, JOB, smartFake());

    expect(packet.job.title).toBe("Data Scientist");
    expect(packet.tailoredResume).toContain("Machine Learning");
    expect(packet.coverLetter).toContain("Acme");
    expect(packet.after.score).toBeGreaterThanOrEqual(packet.before.score);
  });

  it("still returns a packet when cover-letter generation fails", async () => {
    let call = 0;
    const flaky: ChatProvider = {
      id: "ollama",
      label: "flaky",
      complete: async () => {
        call += 1;
        if (call === 1) return "Python and Machine Learning and Deep Learning."; // tailor ok
        throw new Error("cover letter call failed"); // cover letter fails
      },
    };
    const packet = await buildPacket("Python dev.", JOB, flaky);
    expect(packet.tailoredResume).not.toBe("");
    expect(packet.coverLetter).toBe(""); // tolerated, packet still built
  });
});

describe("packetToMarkdown", () => {
  it("renders a complete document with all sections", async () => {
    const packet = await buildPacket("Python dev.", JOB, smartFake());
    const md = packetToMarkdown(packet);
    expect(md).toContain("# Application Packet");
    expect(md).toContain("## Tailored Resume");
    expect(md).toContain("## Cover Letter");
    expect(md).toContain("## Job Description");
  });
});
