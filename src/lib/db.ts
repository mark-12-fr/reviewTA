import Database from 'better-sqlite3'
import path from 'path'
import { randomUUID } from 'crypto'

const dbPath = path.join(process.cwd(), 'reviewta.db')

// Next.js hot-reloads modules in dev; reuse one connection so we never open a
// second handle against the same WAL file.
const globalForDb = globalThis as unknown as { __reviewtaDb?: Database.Database }

const db = globalForDb.__reviewtaDb ?? new Database(dbPath)
globalForDb.__reviewtaDb = db

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS study_sets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL,
    folder_id TEXT,
    source_type TEXT DEFAULT 'text',
    source_content TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    study_set_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_answer INTEGER NOT NULL,
    explanation TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_set_id) REFERENCES study_sets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    study_set_id TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_set_id) REFERENCES study_sets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS progress (
    id TEXT PRIMARY KEY,
    study_set_id TEXT NOT NULL UNIQUE,
    unfamiliar INTEGER DEFAULT 0,
    learning INTEGER DEFAULT 0,
    familiar INTEGER DEFAULT 0,
    mastered INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_set_id) REFERENCES study_sets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS item_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question_id TEXT,
    flashcard_id TEXT,
    study_set_id TEXT NOT NULL,
    status TEXT DEFAULT 'unfamiliar',
    last_reviewed DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS solutions (
    id TEXT PRIMARY KEY,
    subject TEXT DEFAULT 'general',
    problem_text TEXT NOT NULL,
    steps TEXT NOT NULL,
    final_answer TEXT,
    check_note TEXT,
    confidence TEXT,
    warnings TEXT,
    source_type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    thread_kind TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_questions_set ON questions(study_set_id);
  CREATE INDEX IF NOT EXISTS idx_flashcards_set ON flashcards(study_set_id);
  CREATE INDEX IF NOT EXISTS idx_item_progress_set ON item_progress(study_set_id);
  CREATE INDEX IF NOT EXISTS idx_chat_thread ON chat_messages(thread_kind, thread_id, created_at);
`)

// --- Additive migrations -------------------------------------------------
// Databases created before the AI features exist in the wild, so add anything
// that is missing instead of recreating the tables.
function addColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

addColumn('study_sets', 'key_terms', 'TEXT')
addColumn('study_sets', 'status', "TEXT DEFAULT 'ready'")
addColumn('study_sets', 'generated_by', 'TEXT')
addColumn('study_sets', 'source_name', 'TEXT')

addColumn('questions', 'evidence', 'TEXT')
addColumn('questions', 'verified', 'INTEGER DEFAULT 0')
addColumn('questions', 'difficulty', "TEXT DEFAULT 'medium'")
// Identification items live in `questions` too, so mastery tracking and the
// quiz queue treat both kinds the same. MCQ rows keep their options; an
// identification row stores '[]' options and fills answer/accepted instead.
addColumn('questions', 'kind', "TEXT DEFAULT 'mcq'")
addColumn('questions', 'answer', 'TEXT')
addColumn('questions', 'accepted', 'TEXT')

addColumn('flashcards', 'evidence', 'TEXT')
addColumn('flashcards', 'verified', 'INTEGER DEFAULT 0')

addColumn('item_progress', 'correct_streak', 'INTEGER DEFAULT 0')
addColumn('item_progress', 'times_seen', 'INTEGER DEFAULT 0')
addColumn('item_progress', 'times_correct', 'INTEGER DEFAULT 0')

const defaultUser = db.prepare('SELECT id FROM users WHERE id = ?').get('default-user') as
  | { id: string }
  | undefined
if (!defaultUser) {
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run('default-user', 'You')
}

// The app is account-free: everything belongs to this one local profile.
export const LOCAL_USER_ID = 'default-user'

export type MasteryLevel = 'unfamiliar' | 'learning' | 'familiar' | 'mastered'

const LEVELS: MasteryLevel[] = ['unfamiliar', 'learning', 'familiar', 'mastered']

/**
 * Mastery ladder: an item climbs one rung per correct answer and slips one rung
 * when it is missed, never falling below `learning` once it has been seen.
 */
export function nextMastery(current: MasteryLevel, correct: boolean): MasteryLevel {
  const index = Math.max(0, LEVELS.indexOf(current))
  if (correct) return LEVELS[Math.min(LEVELS.length - 1, index + 1)]
  return LEVELS[Math.max(1, index - 1)]
}

/**
 * Recomputes the cached per-set counters. Items that were never studied count as
 * `unfamiliar`, so the four buckets always add up to `total_items`.
 */
export function recomputeProgress(studySetId: string) {
  const questionCount = (
    db.prepare('SELECT COUNT(*) as count FROM questions WHERE study_set_id = ?').get(studySetId) as {
      count: number
    }
  ).count
  const flashcardCount = (
    db
      .prepare('SELECT COUNT(*) as count FROM flashcards WHERE study_set_id = ?')
      .get(studySetId) as { count: number }
  ).count
  const total = questionCount + flashcardCount

  const rows = db
    .prepare(
      `SELECT status, COUNT(*) as count FROM item_progress
       WHERE study_set_id = ?
         AND (question_id IN (SELECT id FROM questions WHERE study_set_id = ?)
              OR flashcard_id IN (SELECT id FROM flashcards WHERE study_set_id = ?))
       GROUP BY status`
    )
    .all(studySetId, studySetId, studySetId) as Array<{ status: string; count: number }>

  const counts: Record<MasteryLevel, number> = {
    unfamiliar: 0,
    learning: 0,
    familiar: 0,
    mastered: 0,
  }
  let tracked = 0
  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as MasteryLevel] = row.count
      tracked += row.count
    }
  }
  counts.unfamiliar += Math.max(0, total - tracked)

  const existing = db.prepare('SELECT id FROM progress WHERE study_set_id = ?').get(studySetId) as
    | { id: string }
    | undefined

  if (existing) {
    db.prepare(
      `UPDATE progress SET unfamiliar = ?, learning = ?, familiar = ?, mastered = ?,
       total_items = ?, updated_at = CURRENT_TIMESTAMP WHERE study_set_id = ?`
    ).run(counts.unfamiliar, counts.learning, counts.familiar, counts.mastered, total, studySetId)
  } else {
    db.prepare(
      `INSERT INTO progress (id, study_set_id, unfamiliar, learning, familiar, mastered, total_items)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      studySetId,
      counts.unfamiliar,
      counts.learning,
      counts.familiar,
      counts.mastered,
      total
    )
  }

  return { ...counts, totalItems: total }
}

export default db
