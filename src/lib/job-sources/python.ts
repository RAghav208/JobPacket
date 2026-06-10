import { spawn } from "node:child_process";

/**
 * Thin Python subprocess helper.
 *
 * JobPacket leans on JobSpy (a Python library) for scraping. Rather than port
 * it, we shell out to a small runner script. This module isolates that boundary:
 * detecting Python, detecting JobSpy, and running the runner. The core app never
 * imports this unless the user actually triggers a scrape.
 */

export interface PyResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** The python executable to use. Override with JOBPACKET_PYTHON. */
export function pythonCmd(env: Record<string, string | undefined> = process.env): string {
  return env.JOBPACKET_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
}

export function runPython(
  args: string[],
  opts: { timeoutMs?: number; cmd?: string } = {},
): Promise<PyResult> {
  const cmd = opts.cmd ?? pythonCmd();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch {
      // spawn itself threw (e.g. ENOENT) — report as a non-zero result, never throw.
      resolve({ code: null, stdout: "", stderr: `spawn failed: ${cmd}` });
      return;
    }

    const timer = opts.timeoutMs
      ? setTimeout(() => child.kill(), opts.timeoutMs)
      : null;

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr || String(err) });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Is a Python interpreter available? */
export async function checkPython(): Promise<boolean> {
  const r = await runPython(["--version"], { timeoutMs: 4000 });
  return r.code === 0;
}

/** Is the `jobspy` package importable in that interpreter? */
export async function checkJobSpy(): Promise<boolean> {
  const r = await runPython(["-c", "import jobspy"], { timeoutMs: 8000 });
  return r.code === 0;
}
