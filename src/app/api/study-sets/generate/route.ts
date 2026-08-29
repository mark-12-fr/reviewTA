import { randomUUID } from 'crypto'
import db, { LOCAL_USER_ID, recomputeProgress } from '@/lib/db'
import { describeAIError, providerInfo } from '@/lib/ai/client'
import { buildStudyPack, extractSource } from '@/lib/ai/generate'
import { UnsupportedFileError, fileToParts, urlToText } from '@/lib/ai/input'
import type { Part } from '@/lib/ai/provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface Event {
  type: 'progress' | 'done' | 'error'
  stage?: string
  detail?: string
  studySetId?: string
  message?: string
  report?: unknown
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected a multipart form submission.' }, { status: 400 })
  }

  const mode = String(form.get('mode') ?? 'text')
  const rawText = String(form.get('text') ?? '').trim()
  const url = String(form.get('url') ?? '').trim()
  const titleHint = String(form.get('title') ?? '').trim()
  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0)

  const requested = {
    questions: Number(form.get('questionCount')) || undefined,
    flashcards: Number(form.get('flashcardCount')) || undefined,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        let sourceText = ''
        let sourceName = titleHint
        let sourceType = mode
        let warnings: string[] = []

        if (mode === 'link') {
          if (!url) throw new UnsupportedFileError('Paste a link first.')
          send({ type: 'progress', stage: 'reading', detail: 'Fetching the page' })
          const page = await urlToText(url)
          sourceText = page.text
          sourceName = sourceName || page.title
          sourceType = 'link'
        } else if (files.length > 0) {
          send({
            type: 'progress',
            stage: 'reading',
            detail: files.length === 1 ? `Reading ${files[0].name}` : `Reading ${files.length} files`,
          })
          const parts: Part[] = []
          for (const file of files) {
            parts.push(...(await fileToParts(file)))
          }
          if (rawText) parts.push({ kind: 'text', text: rawText })

          const extraction = await extractSource(parts, titleHint || undefined)
          sourceText = extraction.text
          sourceName = sourceName || extraction.title
          warnings = extraction.warnings
          sourceType = files[0].type.startsWith('image/') ? 'image' : 'file'
        } else {
          if (!rawText) throw new UnsupportedFileError('Paste some material or attach a file first.')
          sourceText = rawText
          sourceType = 'text'
        }

        if (sourceText.trim().length < 120) {
          throw new UnsupportedFileError(
            'That material is too short to build a study set from. Add more content - a paragraph at minimum.'
          )
        }

        const pack = await buildStudyPack(
          sourceText,
          { questions: requested.questions, flashcards: requested.flashcards },
          (stage, detail) => send({ type: 'progress', stage, detail })
        )

        if (pack.questions.length === 0 && pack.identifications.length === 0 && pack.flashcards.length === 0) {
          throw new Error(
            'Nothing in that material could be turned into questions that check out against the source. Try material with more explanation in it.'
          )
        }

        send({ type: 'progress', stage: 'saving', detail: 'Saving your study set' })

        const studySetId = randomUUID()
        const insert = db.transaction(() => {
          db.prepare(
            `INSERT INTO study_sets
              (id, title, description, user_id, source_type, source_content, source_name, notes, key_terms, status, generated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`
          ).run(
            studySetId,
            titleHint || pack.title,
            pack.description,
            LOCAL_USER_ID,
            sourceType,
            sourceText,
            sourceName || null,
            pack.notes,
            JSON.stringify(pack.keyTerms),
            providerInfo().model
          )

          const insertQuestion = db.prepare(
            `INSERT INTO questions
              (id, study_set_id, kind, question, options, correct_answer, answer, accepted,
               explanation, evidence, verified, difficulty, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          pack.questions.forEach((question, index) => {
            insertQuestion.run(
              randomUUID(),
              studySetId,
              'mcq',
              question.question,
              JSON.stringify(question.options),
              question.correctAnswer,
              null,
              null,
              question.explanation,
              question.evidence,
              question.verified ? 1 : 0,
              question.difficulty,
              index + 1
            )
          })

          // Identification items share the questions table so the quiz queue and
          // the mastery ladder treat both kinds the same.
          pack.identifications.forEach((item, index) => {
            insertQuestion.run(
              randomUUID(),
              studySetId,
              'identification',
              item.prompt,
              '[]',
              0,
              item.answer,
              JSON.stringify(item.acceptedAnswers ?? []),
              null,
              item.evidence,
              item.verified ? 1 : 0,
              item.difficulty,
              pack.questions.length + index + 1
            )
          })

          const insertFlashcard = db.prepare(
            `INSERT INTO flashcards (id, study_set_id, front, back, evidence, verified, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          pack.flashcards.forEach((card, index) => {
            insertFlashcard.run(
              randomUUID(),
              studySetId,
              card.front,
              card.back,
              card.evidence,
              card.verified ? 1 : 0,
              index + 1
            )
          })
        })
        insert()
        recomputeProgress(studySetId)

        send({
          type: 'done',
          studySetId,
          report: {
            ...pack.report,
            questionsKept: pack.questions.length,
            identificationsKept: pack.identifications.length,
            flashcardsKept: pack.flashcards.length,
            sourceWarnings: warnings,
          },
        })
      } catch (error) {
        const message =
          error instanceof UnsupportedFileError ? error.message : describeAIError(error)
        console.error('[generate]', error)
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
