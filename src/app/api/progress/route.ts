import { randomUUID } from 'crypto'
import db, { LOCAL_USER_ID, nextMastery, recomputeProgress, type MasteryLevel } from '@/lib/db'

export const dynamic = 'force-dynamic'

const LEVELS: MasteryLevel[] = ['unfamiliar', 'learning', 'familiar', 'mastered']

function isLevel(value: unknown): value is MasteryLevel {
  return typeof value === 'string' && (LEVELS as string[]).includes(value)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      studySetId?: string
      questionId?: string
      flashcardId?: string
      status?: string
      correct?: boolean
    }
    const { studySetId, questionId, flashcardId } = body

    if (!studySetId || (!questionId && !flashcardId)) {
      return Response.json({ error: 'Missing studySetId and item id.' }, { status: 400 })
    }

    const existing = (
      questionId
        ? db
            .prepare('SELECT * FROM item_progress WHERE user_id = ? AND question_id = ?')
            .get(LOCAL_USER_ID, questionId)
        : db
            .prepare('SELECT * FROM item_progress WHERE user_id = ? AND flashcard_id = ?')
            .get(LOCAL_USER_ID, flashcardId)
    ) as
      | {
          id: string
          status: string
          correct_streak: number | null
          times_seen: number | null
          times_correct: number | null
        }
      | undefined

    const current: MasteryLevel = isLevel(existing?.status) ? existing.status : 'unfamiliar'

    // An answer moves the item along the mastery ladder; an explicit status is a
    // manual self-rating from the flashcard buttons.
    const status: MasteryLevel =
      typeof body.correct === 'boolean'
        ? nextMastery(current, body.correct)
        : isLevel(body.status)
          ? body.status
          : current

    const seen = (existing?.times_seen ?? 0) + 1
    const correctCount = (existing?.times_correct ?? 0) + (body.correct === true ? 1 : 0)
    const streak =
      body.correct === true ? (existing?.correct_streak ?? 0) + 1 : body.correct === false ? 0 : (existing?.correct_streak ?? 0)

    if (existing) {
      db.prepare(
        `UPDATE item_progress
         SET status = ?, correct_streak = ?, times_seen = ?, times_correct = ?, last_reviewed = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(status, streak, seen, correctCount, existing.id)
    } else {
      db.prepare(
        `INSERT INTO item_progress
          (id, user_id, study_set_id, question_id, flashcard_id, status, correct_streak, times_seen, times_correct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        LOCAL_USER_ID,
        studySetId,
        questionId ?? null,
        flashcardId ?? null,
        status,
        streak,
        seen,
        correctCount
      )
    }

    db.prepare('UPDATE study_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(studySetId)

    return Response.json({ status, progress: recomputeProgress(studySetId) })
  } catch (error) {
    console.error('[progress]', error)
    return Response.json({ error: 'Failed to update progress' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const studySetId = searchParams.get('studySetId')
  if (!studySetId) return Response.json({ error: 'Missing studySetId' }, { status: 400 })

  db.prepare('DELETE FROM item_progress WHERE study_set_id = ?').run(studySetId)
  return Response.json({ progress: recomputeProgress(studySetId) })
}
