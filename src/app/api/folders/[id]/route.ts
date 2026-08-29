import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const folder = db.prepare('SELECT id, name, color FROM folders WHERE id = ?').get(id) as
    | { id: string; name: string; color: string | null }
    | undefined
  if (!folder) return Response.json({ error: 'Folder not found' }, { status: 404 })
  return Response.json({ ...folder, color: folder.color ?? 'bg-m3' })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const existing = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as
    | { name: string; color: string | null }
    | undefined
  if (!existing) return Response.json({ error: 'Folder not found' }, { status: 404 })

  db.prepare('UPDATE folders SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    body.name ?? existing.name,
    body.color ?? existing.color,
    id
  )
  return Response.json(db.prepare('SELECT * FROM folders WHERE id = ?').get(id))
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Study sets outlive their folder - only the grouping goes away.
  db.prepare('UPDATE study_sets SET folder_id = NULL WHERE folder_id = ?').run(id)
  db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  return Response.json({ success: true })
}
