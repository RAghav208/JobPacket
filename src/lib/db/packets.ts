import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { cvHash } from "./hash";
import type { JobPosting } from "../job-sources/types";

export { cvHash };

/**
 * Local packet storage (SQLite, via Node's built-in node:sqlite — no native dep).
 *
 * DB lives at ~/.jobpacket/jobpacket.db. Packets are keyed by (cvHash, jobId) so
 * re-approving the same job with the same CV loads the saved packet instantly
 * instead of re-running the AI. Override path with JOBPACKET_DB_PATH (tests use
 * ":memory:").
 */

export interface PacketRecord {
  id: string; // `${cvHash}:${jobId}`
  cvHash: string;
  jobId: string;
  job: JobPosting;
  score: number | null;
  matched: string[];
  missing: string[];
  tailoredResume: string;
  coverLetter: string;
  addedSkills: string[];
  learningPlan: string;
  companyResearch: string;
  createdAt: string;
}

export interface SavePacketInput {
  cvHash: string;
  jobId: string;
  job: JobPosting;
  score: number | null;
  matched: string[];
  missing: string[];
  tailoredResume: string;
  coverLetter: string;
  addedSkills: string[];
  learningPlan?: string;
  companyResearch?: string;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS packets (
    id TEXT PRIMARY KEY,
    cv_hash TEXT NOT NULL,
    job_id TEXT NOT NULL,
    job_json TEXT NOT NULL,
    score INTEGER,
    matched_json TEXT NOT NULL,
    missing_json TEXT NOT NULL,
    tailored_resume TEXT NOT NULL,
    cover_letter TEXT NOT NULL,
    added_skills_json TEXT NOT NULL,
    learning_plan TEXT NOT NULL DEFAULT '',
    company_research TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
`;

/** Add columns introduced after the first release (no-op if already present). */
function migrate(db: DatabaseSync): void {
  const cols = db.prepare(`PRAGMA table_info(packets)`).all() as Array<{ name: string }>;
  const have = new Set(cols.map((c) => c.name));
  if (!have.has("learning_plan")) {
    db.exec(`ALTER TABLE packets ADD COLUMN learning_plan TEXT NOT NULL DEFAULT ''`);
  }
  if (!have.has("company_research")) {
    db.exec(`ALTER TABLE packets ADD COLUMN company_research TEXT NOT NULL DEFAULT ''`);
  }
}

export interface PacketStore {
  save(input: SavePacketInput): PacketRecord;
  get(cvHashValue: string, jobId: string): PacketRecord | null;
  getById(id: string): PacketRecord | null;
  list(limit?: number): PacketRecord[];
}

type Row = {
  id: string;
  cv_hash: string;
  job_id: string;
  job_json: string;
  score: number | null;
  matched_json: string;
  missing_json: string;
  tailored_resume: string;
  cover_letter: string;
  added_skills_json: string;
  learning_plan: string;
  company_research: string;
  created_at: string;
};

function rowToRecord(r: Row): PacketRecord {
  return {
    id: r.id,
    cvHash: r.cv_hash,
    jobId: r.job_id,
    job: JSON.parse(r.job_json) as JobPosting,
    score: r.score,
    matched: JSON.parse(r.matched_json) as string[],
    missing: JSON.parse(r.missing_json) as string[],
    tailoredResume: r.tailored_resume,
    coverLetter: r.cover_letter,
    addedSkills: JSON.parse(r.added_skills_json) as string[],
    learningPlan: r.learning_plan ?? "",
    companyResearch: r.company_research ?? "",
    createdAt: r.created_at,
  };
}

export function createPacketStore(dbPath: string): PacketStore {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  migrate(db);

  return {
    save(input) {
      const id = `${input.cvHash}:${input.jobId}`;
      const createdAt = new Date().toISOString();
      const learningPlan = input.learningPlan ?? "";
      const companyResearch = input.companyResearch ?? "";
      db.prepare(
        `INSERT OR REPLACE INTO packets
         (id, cv_hash, job_id, job_json, score, matched_json, missing_json,
          tailored_resume, cover_letter, added_skills_json, learning_plan,
          company_research, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.cvHash,
        input.jobId,
        JSON.stringify(input.job),
        input.score,
        JSON.stringify(input.matched),
        JSON.stringify(input.missing),
        input.tailoredResume,
        input.coverLetter,
        JSON.stringify(input.addedSkills),
        learningPlan,
        companyResearch,
        createdAt,
      );
      return { ...input, id, createdAt, learningPlan, companyResearch };
    },
    get(cvHashValue, jobId) {
      const row = db
        .prepare(`SELECT * FROM packets WHERE id = ?`)
        .get(`${cvHashValue}:${jobId}`) as Row | undefined;
      return row ? rowToRecord(row) : null;
    },
    getById(id) {
      const row = db.prepare(`SELECT * FROM packets WHERE id = ?`).get(id) as Row | undefined;
      return row ? rowToRecord(row) : null;
    },
    list(limit = 100) {
      const rows = db
        .prepare(`SELECT * FROM packets ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as Row[];
      return rows.map(rowToRecord);
    },
  };
}

let singleton: PacketStore | null = null;
function store(): PacketStore {
  if (singleton) return singleton;
  const path = process.env.JOBPACKET_DB_PATH;
  if (path) {
    singleton = createPacketStore(path);
  } else {
    const dir = join(homedir(), ".jobpacket");
    mkdirSync(dir, { recursive: true });
    singleton = createPacketStore(join(dir, "jobpacket.db"));
  }
  return singleton;
}

export const savePacket = (input: SavePacketInput): PacketRecord => store().save(input);
export const getPacket = (h: string, jobId: string): PacketRecord | null => store().get(h, jobId);
export const getPacketById = (id: string): PacketRecord | null => store().getById(id);
export const listPackets = (limit?: number): PacketRecord[] => store().list(limit);
