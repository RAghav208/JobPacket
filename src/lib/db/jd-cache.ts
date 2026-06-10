import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Cache of AI-extracted JD skills, keyed by a hash of the job description.
 *
 * A job description's required skills never change, so we pay the AI extraction
 * cost ONCE per unique JD — every later search/score that sees the same job is
 * instant. Only AI extractions are cached (keyword-fallback results are not, so
 * they get retried when an agent is available). Same DB file as packets.
 */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS jd_skills (
    desc_hash TEXT PRIMARY KEY,
    skills_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

let db: DatabaseSync | null = null;
function conn(): DatabaseSync {
  if (db) return db;
  const path = process.env.JOBPACKET_DB_PATH;
  if (path) {
    db = new DatabaseSync(path);
  } else {
    const dir = join(homedir(), ".jobpacket");
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, "jobpacket.db"));
  }
  db.exec(SCHEMA);
  return db;
}

export function getJdSkillsCached(descHash: string): string[] | null {
  const row = conn()
    .prepare(`SELECT skills_json FROM jd_skills WHERE desc_hash = ?`)
    .get(descHash) as { skills_json: string } | undefined;
  return row ? (JSON.parse(row.skills_json) as string[]) : null;
}

export function saveJdSkillsCached(descHash: string, skills: string[]): void {
  conn()
    .prepare(
      `INSERT OR REPLACE INTO jd_skills (desc_hash, skills_json, created_at) VALUES (?, ?, ?)`,
    )
    .run(descHash, JSON.stringify(skills), new Date().toISOString());
}
