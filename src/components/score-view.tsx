import type { ScoreResult } from "@/lib/score-engine";
import { MetaLabel } from "@/components/ui/card";

export function ScoreBar({ score }: { score: number }) {
  const tone =
    score >= 75 ? "bg-good" : score >= 45 ? "bg-signal" : "bg-warn";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-track">
        <div
          className={`h-full rounded-full ${tone} transition-[width] duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-sm font-semibold tabular-nums text-fg">{score}%</span>
    </div>
  );
}

/** The "gap" readout: score + matched + missing. Shared by manual scoring and job results. */
export function ScoreView({ result }: { result: ScoreResult }) {
  return (
    <div className="space-y-4">
      <ScoreBar score={result.score} />
      <p className="text-sm text-muted">{result.explanation}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <MetaLabel className="mb-2">Matched ({result.matched.length})</MetaLabel>
          <ul className="space-y-1">
            {result.matched.map((m) => (
              <li key={m.skill} className="flex items-baseline gap-1.5 text-sm text-fg">
                <span className="text-good">✓</span>
                <span>{m.skill}</span>
                {m.method === "synonym" && (
                  <span className="font-mono text-[11px] text-faint">via &ldquo;{m.matchedTerm}&rdquo;</span>
                )}
              </li>
            ))}
            {result.matched.length === 0 && (
              <li className="text-sm text-faint">Nothing matched yet.</li>
            )}
          </ul>
        </div>

        <div>
          <MetaLabel className="mb-2">Missing ({result.missing.length})</MetaLabel>
          <ul className="space-y-1">
            {result.missing.map((skill) => (
              <li key={skill} className="flex items-baseline gap-1.5 text-sm text-fg">
                <span className="text-warn">✗</span>
                <span>{skill}</span>
              </li>
            ))}
            {result.missing.length === 0 && result.jdSkills.length > 0 && (
              <li className="text-sm text-faint">You cover everything the JD asks for.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
