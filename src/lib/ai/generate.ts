import { getProvider } from './client'
import type { Part } from './provider'
import {
  ExtractionSchema,
  ReviewSchema,
  StudyPackSchema,
  type Extraction,
  type GeneratedFlashcard,
  type GeneratedIdentification,
  type GeneratedQuestion,
  type StudyPack,
} from './schemas'
import { GROUNDING_DROP_BELOW, GROUNDING_TRUSTED, clamp, evidenceScore, wordCount } from './grounding'

/** Shared house rules. Accuracy is the product here, so they lead every prompt. */
const ACCURACY_RULES = `Accuracy rules - these override everything else:
- Work ONLY from the SOURCE MATERIAL the student provided. Never add facts from your own knowledge, even when they are true.
- If the source does not support an item, do not write that item. Fewer, correct items always beat more, shaky ones.
- Write in the same language as the source material. If the source is in Filipino, Bisaya, or Hiligaynon, answer in that language.
- Write mathematics in plain Unicode (x², √9, ≤, π, 3/4). Never emit LaTeX or backslash commands.
- Preserve the source's own terminology, spelling, and definitions rather than substituting your own.
- Never use emoji or decorative symbols anywhere in the output. Plain words and standard punctuation only.`

type Progress = (stage: string, detail?: string) => void

/**
 * Step 1 - turn whatever the student uploaded (photo, PDF, pasted text, web page)
 * into plain text. Everything downstream is grounded against this transcript, and
 * the student can read it back to confirm nothing was misread.
 */
export async function extractSource(parts: Part[], hint?: string): Promise<Extraction> {
  return getProvider().structured({
    label: 'transcription',
    schema: ExtractionSchema,
    system: `You transcribe study material for a reviewer app.

${ACCURACY_RULES}

Transcribe the material completely and faithfully into markdown: keep headings, numbered lists, tables, formulas, and labels. Do not summarise, do not fix the author's mistakes, and do not fill in text you cannot actually read - list anything unreadable under warnings instead.`,
    parts: [
      ...parts,
      {
        kind: 'text',
        text: hint ? `Transcribe this material. Context from the student: ${hint}` : 'Transcribe this material.',
      },
    ],
  })
}

/**
 * How many items to aim for. This is a target, not a quota - the prompt tells
 * the model to write fewer when the material is thin, and the grounding check
 * removes anything it could not support.
 */
export function suggestedCounts(sourceText: string) {
  const words = wordCount(sourceText)
  return {
    questions: clamp(Math.round(words / 55), 6, 30),
    identifications: clamp(Math.round(words / 80), 4, 18),
    flashcards: clamp(Math.round(words / 70), 5, 25),
  }
}

/** Step 2 - write the notes, flashcards, and quiz from the transcript. */
export async function generateStudyPack(
  sourceText: string,
  counts: { questions: number; identifications: number; flashcards: number }
): Promise<StudyPack> {
  return getProvider().structured({
    label: 'study set',
    schema: StudyPackSchema,
    system: `You build study sets for a student revising for an exam.

${ACCURACY_RULES}

NOTES: rewrite the source as clean revision notes in markdown - headings, short paragraphs, bullet lists, and a bolded term before each definition. Cover every section of the source in its original order. Do not invent examples or sections.

FLASHCARDS: one idea per card. The front is a term or a short question, the back is the answer in one or two sentences taken from the source.

MULTIPLE-CHOICE QUESTIONS: exactly four options each, exactly one of which is correct according to the source.
- Distractors must be plausible to someone who skimmed the material, but clearly wrong to someone who read it. Never use "all of the above", "none of the above", or two options that mean the same thing.
- Keep all four options similar in length and grammar, so the answer is not guessable from its shape.
- Vary what you test: definitions, purpose, differences between concepts, and applying a rule from the source.
- The explanation says why the correct option is right AND why the tempting wrong one fails.

IDENTIFICATION ITEMS: the student types the answer, so the clue must point to exactly one term.
- The prompt is a definition, description, or function taken from the source, with the term itself removed. Never leave the answer visible inside the prompt.
- The answer is the exact term the source uses: one word or a short phrase, never a sentence and never a whole definition.
- Write an item only when no other term in the source also fits the clue. If two terms could both be right, do not write it.
- acceptedAnswers holds other wordings THE SOURCE ITSELF gives for the same thing - a stated synonym, or an abbreviation and its full form. Leave it empty when the source gives only one wording. Never invent synonyms.

EVIDENCE: every flashcard, question, and identification carries an "evidence" field holding a quote copied word-for-word from the source that proves the answer. Copy it exactly, characters and all - it is checked against the source automatically, and any item whose quote cannot be found is thrown away. If you cannot quote the source for an item, do not write that item.`,
    parts: [
      {
        kind: 'text',
        text: `Build a study set from this source material.

Aim for about ${counts.questions} multiple-choice questions, ${counts.identifications} identification items, and ${counts.flashcards} flashcards - write fewer if the material does not support that many.

<source_material>
${sourceText}
</source_material>`,
      },
    ],
  })
}

export interface QuestionVerdict {
  verdict: 'ok' | 'fix' | 'drop'
  correctAnswer: number
  explanation: string
  issue: string
}

export interface IdentificationVerdict {
  verdict: 'ok' | 'fix' | 'drop'
  answer: string
  issue: string
}

/**
 * Step 3 - an independent pass over the quiz. The reviewer never sees the first
 * pass's reasoning, only the source and the finished items, so it catches
 * mislabelled answers and clues that fit more than one term.
 */
export async function reviewItems(
  sourceText: string,
  questions: GeneratedQuestion[],
  identifications: GeneratedIdentification[]
): Promise<{
  questions: Map<number, QuestionVerdict>
  identifications: Map<number, IdentificationVerdict>
}> {
  const questionVerdicts = new Map<number, QuestionVerdict>()
  const identificationVerdicts = new Map<number, IdentificationVerdict>()
  if (questions.length === 0 && identifications.length === 0) {
    return { questions: questionVerdicts, identifications: identificationVerdicts }
  }

  const renderedQuestions = questions
    .map((question, index) =>
      [
        `[${index}] ${question.question}`,
        ...question.options.map((option, i) => `    ${i}. ${option}`),
        `    labelled correct: ${question.correctAnswer}`,
        `    explanation: ${question.explanation}`,
      ].join('\n')
    )
    .join('\n\n')

  const renderedIdentifications = identifications
    .map((item, index) =>
      [
        `[${index}] clue: ${item.prompt}`,
        `    answer: ${item.answer}`,
        `    also accepted: ${item.acceptedAnswers.join(' | ') || '(none)'}`,
      ].join('\n')
    )
    .join('\n\n')

  const parsed = await getProvider().structured({
    label: 'review',
    schema: ReviewSchema,
    system: `You are a strict exam proofreader. Someone else wrote these items from the source material below. Your job is to catch their mistakes, not to be agreeable.

Judge everything using ONLY the source material.

For each multiple-choice question return:
- "drop" if the source does not answer it, if two or more options are defensible, if the question is ambiguous, or if none of the options is correct.
- "fix" if exactly one option is correct but a different index was labelled, or if the explanation is wrong or misleading. Return the right index and a corrected explanation.
- "ok" if the labelled answer and the explanation are both correct.
Always return correctAnswer as the index you believe is right, and explanation as the wording that should be used.

For each identification item return:
- "drop" if the clue fits more than one term in the source, if the answer is not in the source, if the answer is a whole sentence rather than a term, or if the clue gives the answer away.
- "fix" if the clue is sound but the answer should be worded the way the source words it. Return the corrected term.
- "ok" if the clue points to exactly one term and the answer matches the source.
Always return answer as the term you believe is right.

Return one entry for every index in both lists, in order. Be blunt in "issue".`,
    parts: [
      {
        kind: 'text',
        text: `<source_material>
${sourceText}
</source_material>

<multiple_choice>
${renderedQuestions || '(none)'}
</multiple_choice>

<identification>
${renderedIdentifications || '(none)'}
</identification>`,
      },
    ],
  })

  for (const review of parsed.reviews) {
    if (review.index >= 0 && review.index < questions.length) {
      questionVerdicts.set(review.index, {
        verdict: review.verdict,
        correctAnswer: review.correctAnswer,
        explanation: review.explanation,
        issue: review.issue,
      })
    }
  }

  for (const review of parsed.identificationReviews) {
    if (review.index >= 0 && review.index < identifications.length) {
      identificationVerdicts.set(review.index, {
        verdict: review.verdict,
        answer: review.answer,
        issue: review.issue,
      })
    }
  }

  return { questions: questionVerdicts, identifications: identificationVerdicts }
}

export interface VerifiedQuestion extends GeneratedQuestion {
  verified: boolean
}
export interface VerifiedIdentification extends GeneratedIdentification {
  verified: boolean
}
export interface VerifiedFlashcard extends GeneratedFlashcard {
  verified: boolean
}

export interface BuiltStudyPack {
  title: string
  description: string
  language: string
  notes: string
  keyTerms: Array<{ term: string; definition: string }>
  questions: VerifiedQuestion[]
  identifications: VerifiedIdentification[]
  flashcards: VerifiedFlashcard[]
  report: {
    questionsGenerated: number
    identificationsGenerated: number
    flashcardsGenerated: number
    droppedUngrounded: number
    droppedByReview: number
    correctedByReview: number
  }
}

/** Shape checks the schema deliberately leaves to us. */
function isWellFormed(question: GeneratedQuestion): boolean {
  if (question.options.length !== 4) return false
  if (!Number.isInteger(question.correctAnswer)) return false
  if (question.correctAnswer < 0 || question.correctAnswer > 3) return false
  if (question.options.some((option) => !option.trim())) return false
  const unique = new Set(question.options.map((option) => option.trim().toLowerCase()))
  return unique.size === 4
}

/**
 * An identification answer has to be a term, and the clue must not contain it -
 * otherwise the item answers itself.
 */
function isUsableIdentification(item: GeneratedIdentification): boolean {
  const answer = item.answer.trim()
  if (!answer || !item.prompt.trim()) return false
  if (answer.split(/\s+/).length > 6) return false
  return !item.prompt.toLowerCase().includes(answer.toLowerCase())
}

/**
 * The full pipeline: generate, drop anything whose quote is not in the source,
 * then run the independent review and apply its corrections.
 */
export async function buildStudyPack(
  sourceText: string,
  options: { questions?: number; identifications?: number; flashcards?: number } = {},
  onProgress: Progress = () => {}
): Promise<BuiltStudyPack> {
  const suggested = suggestedCounts(sourceText)
  const counts = {
    questions: options.questions ?? suggested.questions,
    identifications: options.identifications ?? suggested.identifications,
    flashcards: options.flashcards ?? suggested.flashcards,
  }

  onProgress('writing', 'Writing notes, flashcards, and quiz questions')
  const pack = await generateStudyPack(sourceText, counts)

  onProgress('grounding', 'Checking every item against your material')
  let droppedUngrounded = 0

  const groundedQuestions = pack.questions.filter((question) => {
    if (!isWellFormed(question) || evidenceScore(sourceText, question.evidence) < GROUNDING_DROP_BELOW) {
      droppedUngrounded++
      return false
    }
    return true
  })

  const groundedIdentifications = pack.identifications.filter((item) => {
    if (!isUsableIdentification(item) || evidenceScore(sourceText, item.evidence) < GROUNDING_DROP_BELOW) {
      droppedUngrounded++
      return false
    }
    return true
  })

  const groundedFlashcards = pack.flashcards.filter((card) => {
    if (
      !card.front.trim() ||
      !card.back.trim() ||
      evidenceScore(sourceText, card.evidence) < GROUNDING_DROP_BELOW
    ) {
      droppedUngrounded++
      return false
    }
    return true
  })

  const reviewCount = groundedQuestions.length + groundedIdentifications.length
  onProgress('verifying', `Double-checking ${reviewCount} question${reviewCount === 1 ? '' : 's'}`)
  const reviews = await reviewItems(sourceText, groundedQuestions, groundedIdentifications)

  let droppedByReview = 0
  let correctedByReview = 0

  const questions: VerifiedQuestion[] = []
  groundedQuestions.forEach((question, index) => {
    const review = reviews.questions.get(index)
    const strongEvidence = evidenceScore(sourceText, question.evidence) >= GROUNDING_TRUSTED

    if (!review) {
      // Unreviewed items still ship, but they are not marked verified.
      questions.push({ ...question, verified: false })
      return
    }
    if (review.verdict === 'drop') {
      droppedByReview++
      return
    }

    const corrected =
      review.verdict === 'fix' &&
      Number.isInteger(review.correctAnswer) &&
      review.correctAnswer >= 0 &&
      review.correctAnswer < 4
        ? review.correctAnswer
        : question.correctAnswer
    if (corrected !== question.correctAnswer) correctedByReview++

    questions.push({
      ...question,
      correctAnswer: corrected,
      explanation: review.explanation || question.explanation,
      verified: strongEvidence,
    })
  })

  const identifications: VerifiedIdentification[] = []
  groundedIdentifications.forEach((item, index) => {
    const review = reviews.identifications.get(index)
    const strongEvidence = evidenceScore(sourceText, item.evidence) >= GROUNDING_TRUSTED

    if (!review) {
      identifications.push({ ...item, verified: false })
      return
    }
    if (review.verdict === 'drop') {
      droppedByReview++
      return
    }

    const corrected = review.verdict === 'fix' && review.answer.trim() ? review.answer.trim() : item.answer
    if (corrected !== item.answer) correctedByReview++

    identifications.push({ ...item, answer: corrected, verified: strongEvidence })
  })

  const flashcards: VerifiedFlashcard[] = groundedFlashcards.map((card) => ({
    ...card,
    verified: evidenceScore(sourceText, card.evidence) >= GROUNDING_TRUSTED,
  }))

  return {
    title: pack.title,
    description: pack.description,
    language: pack.language,
    notes: pack.notes,
    keyTerms: pack.keyTerms,
    questions,
    identifications,
    flashcards,
    report: {
      questionsGenerated: pack.questions.length,
      identificationsGenerated: pack.identifications.length,
      flashcardsGenerated: pack.flashcards.length,
      droppedUngrounded,
      droppedByReview,
      correctedByReview,
    },
  }
}
