import { randomUUID } from 'crypto'
import db, { LOCAL_USER_ID } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const folders = db
    .prepare(
      `SELECT f.id, f.name, f.color, f.created_at,
              (SELECT COUNT(*) FROM study_sets WHERE folder_id = f.id) as study_set_count
       FROM folders f
       ORDER BY f.created_at DESC`
    )
    .all() as Array<{
    id: string
    name: string
    color: string | null
    created_at: string
    study_set_count: number
  }>

  return Response.json(
    folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color ?? 'bg-m3',
      createdAt: folder.created_at,
      studySetCount: folder.study_set_count,
    }))
  )
}

export async function POST(request: Request) {
  const body = await request.json()
  const name = String(body.name ?? '').trim()
  if (!name) return Response.json({ error: 'A folder name is required.' }, { status: 400 })

  const id = randomUUID()
  db.prepare('INSERT INTO folders (id, name, color, user_id) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    body.color ?? 'bg-m3',
    LOCAL_USER_ID
  )

  return Response.json({ id, name, color: body.color ?? 'bg-m3', studySetCount: 0 }, { status: 201 })
}
