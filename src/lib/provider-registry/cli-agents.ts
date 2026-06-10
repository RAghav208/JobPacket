import { spawn } from "node:child_process";
import type { ChatMessage, ChatProvider } from "./types";

/**
 * CLI-agent providers — use the AI coding agent already installed on the user's
 * machine (Claude Code, Codex, Gemini CLI) instead of an API key.
 *
 * Each completion shells out to the agent in headless mode and passes the prompt
 * via STDIN (never on the command line) so there's no shell-injection surface
 * even with `shell: true` (needed on Windows to resolve .cmd/.ps1 shims).
 */

export interface CliAgentSpec {
  id: string;
  label: string;
  bin: string;
  /** Fixed flags for a completion run. Prompt goes via stdin, never here. */
  runArgs: string[];
  /** Flags to test that the binary exists and works. */
  versionArgs: string[];
}

export const CLI_AGENT_SPECS: CliAgentSpec[] = [
  { id: "claude", label: "Claude Code", bin: "claude", runArgs: ["-p"], versionArgs: ["--version"] },
  { id: "codex", label: "Codex", bin: "codex", runArgs: ["exec"], versionArgs: ["--version"] },
  { id: "gemini", label: "Gemini CLI", bin: "gemini", runArgs: [], versionArgs: ["--version"] },
];

/** Flatten chat messages into a single prompt string for a CLI agent. Pure. */
export function flattenMessages(messages: ChatMessage[]): string {
  return messages
    .map((m) => (m.role === "system" ? `# Instructions\n${m.content}` : m.content))
    .join("\n\n");
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runAgent(
  bin: string,
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolve) => {
    let child;
    try {
      // shell:true → Windows resolves .cmd/.ps1 shims and PATHEXT. We pass ONE
      // prepared command string (not an args array) to avoid Node's DEP0190
      // warning; this is injection-safe because `bin` + `args` are fixed internal
      // constants (no user data) and the prompt is sent via stdin, never here.
      const command = [bin, ...args].join(" ");
      child = spawn(command, { shell: true, windowsHide: true });
    } catch (e) {
      resolve({ code: null, stdout: "", stderr: String(e) });
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr || String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

async function isAgentAvailable(spec: CliAgentSpec): Promise<boolean> {
  const r = await runAgent(spec.bin, spec.versionArgs, "", 6000);
  return r.code === 0;
}

// Detection spawns a process per agent; cache briefly so every request doesn't re-probe.
let cache: { at: number; agents: CliAgentSpec[] } | null = null;
const CACHE_MS = 60_000;

export async function detectCliAgents(force = false): Promise<CliAgentSpec[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.agents;
  const checks = await Promise.all(
    CLI_AGENT_SPECS.map(async (s) => ({ s, ok: await isAgentAvailable(s) })),
  );
  const agents = checks.filter((c) => c.ok).map((c) => c.s);
  cache = { at: Date.now(), agents };
  return agents;
}

export function createCliAgentProvider(spec: CliAgentSpec): ChatProvider {
  return {
    id: spec.id,
    label: spec.label,
    async complete(messages, _opts): Promise<string> {
      const prompt = flattenMessages(messages);
      const r = await runAgent(spec.bin, spec.runArgs, prompt, 180_000);
      if (r.code !== 0) {
        throw new Error(`${spec.label} failed: ${(r.stderr || `exit ${r.code}`).trim().slice(0, 300)}`);
      }
      const text = r.stdout.trim();
      if (!text) throw new Error(`${spec.label} returned empty output`);
      return text;
    },
  };
}
