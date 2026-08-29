import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { describeAIError } from '@/lib/ai/client'
import { streamTutorReply, type TutorTurn } from '@/lib/ai/tutor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type ThreadKind = 'study-set' | 'solution'

function loadMaterial(kind: ThreadKind, id: string): string | null {
  if (kind === 'study-set') {
    const set = db
      .prepare('SELECT title, description, notes, source_content FROM study_sets WHERE id = ?')
      .get(id) as
      | { title: string; description: string | null; notes: string | null; source_content: string | null }
      | undefined
    if (!set) return null
    return [
      `Study set: ${set.title}`,
      set.description ? `About: ${set.description}` : '',
      set.notes ? `\n--- Notes ---\n${set.notes}` : '',
      set.source_content ? `\n--- Original material ---\n${set.source_content}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const solution = db
    .prepare('SELECT subject, problem_text, steps, final_answer, check_note FROM solutions WHERE id = ?')
    .get(id) as
    | {
        subject: string
        problem_text: string
        steps: string
        final_answer: string | null
        check_note: string | null
      }
    | undefined
  if (!solution) return null

  let steps = ''
  try {
    const parsed = JSON.parse(solution.steps) as Array<{ title: string; detail: string }>
    steps = parsed.map((step, i) => `${i + 1}. ${step.title}\n${step.detail}`).join('\n')
  } catch {
    steps = solution.steps
  }

  return [
    `Subject: ${solution.subject}`,
    `Problem: ${solution.problem_text}`,
    `\n--- Worked solution ---\n${steps}`,
    `\nAnswer: ${solution.final_answer ?? ''}`,
    solution.check_note ? `Check: ${solution.check_note}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function history(kind: ThreadKind, id: string): TutorTurn[] {
  const rows = db
    .prepare(
      'SELECT role, content FROM chat_messages WHERE thread_kind = ? AND thread_id = ? ORDER BY created_at ASC, rowid ASC'
    )
    .all(kind, id) as Array<{ role: string; content: string }>
  return rows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({ role: row.role as TutorTurn['role'], content: row.content }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kind = (searchParams.get('kind') ?? 'study-set') as ThreadKind
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  return Response.json(history(kind, id))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const kind = (searchParams.get('kind') ?? 'study-set') as ThreadKind
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  db.prepare('DELETE FROM chat_messages WHERE thread_kind = ? AND thread_id = ?').run(kind, id)
  return Response.json({ success: true })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { kind?: ThreadKind; id?: string; message?: string }
    const kind: ThreadKind = body.kind === 'solution' ? 'solution' : 'study-set'
    const id = body.id
    const message = (body.message ?? '').trim()

    if (!id || !message) {
      return Response.json({ error: 'Missing id or message.' }, { status: 400 })
    }

    const material = loadMaterial(kind, id)
    if (material === null) {
      return Response.json({ error: 'That study set no longer exists.' }, { status: 404 })
    }

    const turns = [...history(kind, id), { role: 'user' as const, content: message }]

    db.prepare(
      'INSERT INTO chat_messages (id, thread_kind, thread_id, role, content) VALUES (?, ?, ?, ?, ?)'
    ).run(randomUUID(), kind, id, 'user', message)

    const aiStream = streamTutorReply(material, turns)
    const encoder = new TextEncoder()
    let reply = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiStream) {
            reply += chunk
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (error) {
          console.error('[tutor]', error)
          const note = `\n\n[${describeAIError(error)}]`
          reply += note
          controller.enqueue(encoder.encode(note))
        } finally {
          if (reply.trim()) {
            db.prepare(
              'INSERT INTO chat_messages (id, thread_kind, thread_id, role, content) VALUES (?, ?, ?, ?, ?)'
            ).run(randomUUID(), kind, id, 'assistant', reply)
          }
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[tutor]', error)
    return Response.json({ error: describeAIError(error) }, { status: 500 })
  }
}
