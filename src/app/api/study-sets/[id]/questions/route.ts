import { randomUUID } from 'crypto'
import db, { recomputeProgress } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const questions = db
      .prepare('SELECT * FROM questions WHERE study_set_id = ? ORDER BY sort_order ASC')
      .all(id) as Array<Record<string, unknown>>

    return Response.json(
      questions.map((row) => ({
        id: row.id,
        question: row.question,
        options: JSON.parse(row.options as string) as string[],
        correctAnswer: row.correct_answer,
        explanation: row.explanation,
        evidence: row.evidence,
        verified: Boolean(row.verified),
        difficulty: row.difficulty ?? 'medium',
      }))
    )
  } catch (error) {
    console.error('[questions]', error)
    return Response.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { question, options, correctAnswer, explanation, evidence } = await request.json()

    if (!question || !Array.isArray(options) || options.length !== 4) {
      return Response.json({ error: 'A question and exactly four options are required.' }, { status: 400 })
    }
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
      return Response.json({ error: 'correctAnswer must be an index from 0 to 3.' }, { status: 400 })
    }

    const maxOrder = db
      .prepare('SELECT MAX(sort_order) as max FROM questions WHERE study_set_id = ?')
      .get(id) as { max: number | null }

    const questionId = randomUUID()
    db.prepare(
      `INSERT INTO questions
        (id, study_set_id, question, options, correct_answer, explanation, evidence, verified, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      questionId,
      id,
      question,
      JSON.stringify(options),
      correctAnswer,
      explanation || null,
      evidence || null,
      (maxOrder.max ?? 0) + 1
    )

    recomputeProgress(id)
    return Response.json(db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId), { status: 201 })
  } catch (error) {
    console.error('[questions]', error)
    return Response.json({ error: 'Failed to create question' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')
    if (!questionId) return Response.json({ error: 'Missing questionId' }, { status: 400 })

    db.prepare('DELETE FROM item_progress WHERE question_id = ?').run(questionId)
    db.prepare('DELETE FROM questions WHERE id = ? AND study_set_id = ?').run(questionId, id)
    return Response.json({ progress: recomputeProgress(id) })
  } catch (error) {
    console.error('[questions]', error)
    return Response.json({ error: 'Failed to delete question' }, { status: 500 })
  }
}
