import { randomUUID } from 'crypto'
import db from '@/lib/db'
import { describeAIError } from '@/lib/ai/client'
import { UnsupportedFileError, fileToParts } from '@/lib/ai/input'
import type { Part } from '@/lib/ai/provider'
import { solveProblem } from '@/lib/ai/solve'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

export async function GET() {
  const rows = db
    .prepare(
      `SELECT id, subject, problem_text, final_answer, confidence, created_at
       FROM solutions ORDER BY created_at DESC LIMIT 20`
    )
    .all()
  return Response.json(rows)
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const subject = String(form.get('subject') ?? 'general')
    const text = String(form.get('text') ?? '').trim()
    const file = form.get('image')

    const parts: Part[] = []
    let sourceType = 'text'

    if (file instanceof File && file.size > 0) {
      parts.push(...(await fileToParts(file)))
      sourceType = file.type.startsWith('image/') ? 'image' : 'file'
    }
    if (text) {
      parts.push({ kind: 'text', text: `The problem:\n${text}` })
    }
    if (parts.length === 0) {
      return Response.json({ error: 'Add a photo of the problem or type it out.' }, { status: 400 })
    }

    const solution = await solveProblem(parts, subject)

    const id = randomUUID()
    db.prepare(
      `INSERT INTO solutions
        (id, subject, problem_text, steps, final_answer, check_note, confidence, warnings, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      solution.subject || subject,
      solution.problemText,
      JSON.stringify(solution.steps),
      solution.finalAnswer,
      solution.check,
      solution.confidence,
      JSON.stringify(solution.warnings),
      sourceType
    )

    return Response.json({ id, ...solution })
  } catch (error) {
    const message = error instanceof UnsupportedFileError ? error.message : describeAIError(error)
    console.error('[solve]', error)
    return Response.json({ error: message }, { status: 500 })
  }
}
