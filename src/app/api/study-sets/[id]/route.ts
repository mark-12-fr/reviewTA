import db, { recomputeProgress } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface QuestionRow {
  id: string
  kind: string | null
  question: string
  options: string
  correct_answer: number
  answer: string | null
  accepted: string | null
  explanation: string | null
  evidence: string | null
  verified: number | null
  difficulty: string | null
  sort_order: number
}

function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

interface FlashcardRow {
  id: string
  front: string
  back: string
  evidence: string | null
  verified: number | null
  sort_order: number
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const studySet = db.prepare('SELECT * FROM study_sets WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined

    if (!studySet) {
      return Response.json({ error: 'Study set not found' }, { status: 404 })
    }

    const statuses = new Map<string, string>()
    const progressRows = db
      .prepare(
        'SELECT question_id, flashcard_id, status FROM item_progress WHERE study_set_id = ?'
      )
      .all(id) as Array<{ question_id: string | null; flashcard_id: string | null; status: string }>
    for (const row of progressRows) {
      const key = row.question_id ?? row.flashcard_id
      if (key) statuses.set(key, row.status)
    }

    const questions = (
      db
        .prepare('SELECT * FROM questions WHERE study_set_id = ? ORDER BY sort_order ASC')
        .all(id) as QuestionRow[]
    ).map((row) => ({
      id: row.id,
      kind: row.kind === 'identification' ? ('identification' as const) : ('mcq' as const),
      question: row.question,
      options: parseList(row.options),
      correctAnswer: row.correct_answer,
      answer: row.answer,
      accepted: parseList(row.accepted),
      explanation: row.explanation,
      evidence: row.evidence,
      verified: Boolean(row.verified),
      difficulty: row.difficulty ?? 'medium',
      status: statuses.get(row.id) ?? 'unfamiliar',
    }))

    const flashcards = (
      db
        .prepare('SELECT * FROM flashcards WHERE study_set_id = ? ORDER BY sort_order ASC')
        .all(id) as FlashcardRow[]
    ).map((row) => ({
      id: row.id,
      front: row.front,
      back: row.back,
      evidence: row.evidence,
      verified: Boolean(row.verified),
      status: statuses.get(row.id) ?? 'unfamiliar',
    }))

    let keyTerms: Array<{ term: string; definition: string }> = []
    if (typeof studySet.key_terms === 'string' && studySet.key_terms) {
      try {
        keyTerms = JSON.parse(studySet.key_terms)
      } catch {
        keyTerms = []
      }
    }

    return Response.json({
      id: studySet.id,
      title: studySet.title,
      description: studySet.description,
      notes: studySet.notes,
      keyTerms,
      sourceContent: studySet.source_content,
      sourceType: studySet.source_type,
      sourceName: studySet.source_name,
      status: studySet.status ?? 'ready',
      generatedBy: studySet.generated_by,
      folderId: studySet.folder_id,
      createdAt: studySet.created_at,
      updatedAt: studySet.updated_at,
      progress: recomputeProgress(id),
      questions,
      flashcards,
    })
  } catch (error) {
    console.error('[study-set]', error)
    return Response.json({ error: 'Failed to fetch study set' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = db.prepare('SELECT * FROM study_sets WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!existing) return Response.json({ error: 'Study set not found' }, { status: 404 })

    db.prepare(
      `UPDATE study_sets
       SET title = ?, description = ?, folder_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      body.title ?? existing.title,
      body.description ?? existing.description,
      body.folderId === undefined ? existing.folder_id : body.folderId,
      body.notes ?? existing.notes,
      id
    )

    return Response.json(db.prepare('SELECT * FROM study_sets WHERE id = ?').get(id))
  } catch (error) {
    console.error('[study-set]', error)
    return Response.json({ error: 'Failed to update study set' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    db.prepare('DELETE FROM item_progress WHERE study_set_id = ?').run(id)
    db.prepare("DELETE FROM chat_messages WHERE thread_kind = 'study-set' AND thread_id = ?").run(id)
    db.prepare('DELETE FROM study_sets WHERE id = ?').run(id)
    return Response.json({ success: true })
  } catch (error) {
    console.error('[study-set]', error)
    return Response.json({ error: 'Failed to delete study set' }, { status: 500 })
  }
}
