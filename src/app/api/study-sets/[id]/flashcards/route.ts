import { randomUUID } from 'crypto'
import db, { recomputeProgress } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const flashcards = db
      .prepare('SELECT * FROM flashcards WHERE study_set_id = ? ORDER BY sort_order ASC')
      .all(id) as Array<Record<string, unknown>>

    return Response.json(
      flashcards.map((row) => ({
        id: row.id,
        front: row.front,
        back: row.back,
        evidence: row.evidence,
        verified: Boolean(row.verified),
      }))
    )
  } catch (error) {
    console.error('[flashcards]', error)
    return Response.json({ error: 'Failed to fetch flashcards' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { front, back, evidence } = await request.json()

    if (!front?.trim() || !back?.trim()) {
      return Response.json({ error: 'Both sides of the card are required.' }, { status: 400 })
    }

    const maxOrder = db
      .prepare('SELECT MAX(sort_order) as max FROM flashcards WHERE study_set_id = ?')
      .get(id) as { max: number | null }

    const flashcardId = randomUUID()
    db.prepare(
      `INSERT INTO flashcards (id, study_set_id, front, back, evidence, verified, sort_order)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).run(flashcardId, id, front.trim(), back.trim(), evidence || null, (maxOrder.max ?? 0) + 1)

    recomputeProgress(id)
    return Response.json(db.prepare('SELECT * FROM flashcards WHERE id = ?').get(flashcardId), {
      status: 201,
    })
  } catch (error) {
    console.error('[flashcards]', error)
    return Response.json({ error: 'Failed to create flashcard' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const flashcardId = searchParams.get('flashcardId')
    if (!flashcardId) return Response.json({ error: 'Missing flashcardId' }, { status: 400 })

    db.prepare('DELETE FROM item_progress WHERE flashcard_id = ?').run(flashcardId)
    db.prepare('DELETE FROM flashcards WHERE id = ? AND study_set_id = ?').run(flashcardId, id)
    return Response.json({ progress: recomputeProgress(id) })
  } catch (error) {
    console.error('[flashcards]', error)
    return Response.json({ error: 'Failed to delete flashcard' }, { status: 500 })
  }
}
