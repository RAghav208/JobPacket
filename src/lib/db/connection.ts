import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * The single shared SQLite connection for the app. Both the packet store and the
 * JD-skill cache use this one handle (same file: ~/.jobpacket/jobpacket.db, or
 * JOBPACKET_DB_PATH), so there are never two writers contending on one file.
 */
let db: DatabaseSync | null = null;

export function sharedDb(): DatabaseSync {
  if (db) return db;
  const path = process.env.JOBPACKET_DB_PATH;
  if (path) {
    db = new DatabaseSync(path);
  } else {
    const dir = join(homedir(), ".jobpacket");
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, "jobpacket.db"));
  }
  return db;
}
