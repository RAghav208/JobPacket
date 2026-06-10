/**
 * CLI demo of the full loop — "see the gap", then close it if AI is configured.
 *
 *   npm run demo                       # built-in sample (Raghav vs Google JD)
 *   npm run demo -- resume.txt jd.txt  # your own files
 *
 * Scoring always runs (no Python, no key). Tailoring runs only if JobPacket
 * auto-discovers a chat provider (a running Ollama or an API key in your env).
 */
import { readFileSync } from "node:fs";
import { scoreResume } from "./lib/score-engine/index";
import { tailorResume } from "./lib/tailor-engine/index";
import { getChatProvider } from "./lib/provider-registry/index";
import type { ScoreResult } from "./lib/score-engine/index";

const SAMPLE_RESUME = `
TECHNICAL SKILLS: Python, C, C++, HTML, Pandas, NumPy, scikit-learn,
TensorFlow, Deep Learning, Machine Learning, Feature Engineering, Git, GitHub.
Explored large language model architecture through academic research.
Built pipelines for text generation and NLP tasks.
`;

const SAMPLE_JD = `
Minimum: enrolled in a degree program; experience in Machine Learning,
Deep Learning, Natural Language Processing, or Data Science; one programming
language such as Python, Java, or C++.
Preferred: contributing to research communities, including Publications in
major conferences or journals.
`;

const bar = (n: number) => "█".repeat(Math.round(n / 5)).padEnd(20, "░") + ` ${n}%`;

function printScore(label: string, r: ScoreResult) {
  console.log(`  ${label}  ${bar(r.score)}`);
}

async function main() {
  const [resumeArg, jdArg] = process.argv.slice(2);
  const resume = resumeArg ? readFileSync(resumeArg, "utf8") : SAMPLE_RESUME;
  const jd = jdArg ? readFileSync(jdArg, "utf8") : SAMPLE_JD;

  const before = scoreResume(resume, jd);

  console.log("\n  THE GAP");
  console.log("  ─────────────────────────────────────────────");
  printScore("Your resume: ", before);
  console.log(`  ${before.explanation}\n`);

  console.log(`  ✓ Matched (${before.matched.length})`);
  for (const m of before.matched) {
    const how = m.method === "synonym" ? `  (via "${m.matchedTerm}")` : "";
    console.log(`     • ${m.skill}${how}`);
  }
  console.log(`\n  ✗ Missing (${before.missing.length})`);
  for (const skill of before.missing) console.log(`     • ${skill}`);

  const provider = await getChatProvider();

  if (!provider) {
    console.log("\n  ─────────────────────────────────────────────");
    console.log("  No AI provider found, so the score is all you get for now.");
    console.log("  To close the gap, configure one (any of these), then re-run:");
    console.log("    • Run Ollama locally        (free)");
    console.log("    • export ANTHROPIC_API_KEY  / OPENAI_API_KEY / GEMINI_API_KEY\n");
    return;
  }

  console.log(`\n  Tailoring with ${provider.label}...`);
  let r;
  try {
    r = await tailorResume(resume, jd, provider);
  } catch (err) {
    console.log("\n  ─────────────────────────────────────────────");
    console.log(`  Tailoring failed: ${(err as Error).message}`);
    console.log("  (The score above still stands — only the rewrite step failed.)\n");
    return;
  }
  if (!r.tailoredText) {
    console.log("\n  Provider returned an empty rewrite — skipping. Score above stands.\n");
    return;
  }

  console.log("\n  CLOSING THE GAP");
  console.log("  ─────────────────────────────────────────────");
  printScore("Before:      ", r.before);
  printScore("After:       ", r.after);

  if (r.addedSkills.length) {
    console.log(`\n  ⚠ Tailoring surfaced these skills — KEEP ONLY IF TRUE:`);
    for (const s of r.addedSkills) console.log(`     • ${s}  (confirm you actually have this)`);
    console.log("  The score above counts them; uncheck any that aren't real and it drops.");
  } else {
    console.log("\n  No new skills were added — only wording was improved.");
  }
  console.log("\n  ── Tailored resume ──");
  console.log(r.tailoredText.split("\n").map((l) => "  " + l).join("\n"));
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
