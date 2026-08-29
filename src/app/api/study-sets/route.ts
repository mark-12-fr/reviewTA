import { randomUUID } from 'crypto'
import db, { LOCAL_USER_ID, recomputeProgress } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface SetRow {
  id: string
  title: string
  description: string | null
  source_type: string
  source_name: string | null
  status: string | null
  created_at: string
  updated_at: string
  folder_id: string | null
  unfamiliar: number | null
  learning: number | null
  familiar: number | null
  mastered: number | null
  total_items: number | null
  question_count: number
  identification_count: number
  flashcard_count: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    const rows = db
      .prepare(
        `SELECT
           s.id, s.title, s.description, s.source_type, s.source_name, s.status,
           s.created_at, s.updated_at, s.folder_id,
           p.unfamiliar, p.learning, p.familiar, p.mastered, p.total_items,
           (SELECT COUNT(*) FROM questions WHERE study_set_id = s.id AND COALESCE(kind, 'mcq') = 'mcq') as question_count,
           (SELECT COUNT(*) FROM questions WHERE study_set_id = s.id AND kind = 'identification') as identification_count,
           (SELECT COUNT(*) FROM flashcards WHERE study_set_id = s.id) as flashcard_count
         FROM study_sets s
         LEFT JOIN progress p ON p.study_set_id = s.id
         ${folderId ? 'WHERE s.folder_id = ?' : ''}
         ORDER BY s.updated_at DESC`
      )
      .all(...(folderId ? [folderId] : [])) as SetRow[]

    const studySets = rows.map((row) => {
      const actualTotal = row.question_count + row.identification_count + row.flashcard_count
      // Older rows carry counters that no longer match their items; repair them
      // rather than showing a number we know to be wrong.
      const progress =
        row.total_items === actualTotal && row.total_items !== null
          ? {
              unfamiliar: row.unfamiliar ?? 0,
              learning: row.learning ?? 0,
              familiar: row.familiar ?? 0,
              mastered: row.mastered ?? 0,
              totalItems: row.total_items,
            }
          : recomputeProgress(row.id)

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        sourceType: row.source_type,
        sourceName: row.source_name,
        status: row.status ?? 'ready',
        folderId: row.folder_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        progress,
        counts: {
          questions: row.question_count,
          identifications: row.identification_count,
          flashcards: row.flashcard_count,
        },
      }
    })

    return Response.json(studySets)
  } catch (error) {
    console.error('[study-sets]', error)
    return Response.json({ error: 'Failed to fetch study sets' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, sourceType, sourceContent, folderId, notes } = body

    if (!title || !String(title).trim()) {
      return Response.json({ error: 'A title is required.' }, { status: 400 })
    }

    const id = randomUUID()
    db.prepare(
      `INSERT INTO study_sets (id, title, description, user_id, folder_id, source_type, source_content, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready')`
    ).run(
      id,
      String(title).trim(),
      description || null,
      LOCAL_USER_ID,
      folderId || null,
      sourceType || 'text',
      sourceContent || null,
      notes || null
    )
    recomputeProgress(id)

    const studySet = db.prepare('SELECT * FROM study_sets WHERE id = ?').get(id)
    return Response.json(studySet, { status: 201 })
  } catch (error) {
    console.error('[study-sets]', error)
    return Response.json({ error: 'Failed to create study set' }, { status: 500 })
  }
}
