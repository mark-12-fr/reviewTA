import { z } from 'zod'

// Schemas are kept free of numeric/length constraints on purpose: the API's
// structured-output subset is narrow, so shape is enforced here and the finer
// rules (option counts, index range, grounding) are checked in code afterwards.

export const ExtractionSchema = z.object({
  title: z.string().describe('A short, specific title for this material (max 8 words).'),
  text: z
    .string()
    .describe(
      'The full material transcribed as clean markdown. Copy it faithfully - do not summarise, reorder, or add anything.'
    ),
  language: z.string().describe('The language the material is written in, e.g. "English", "Filipino".'),
  warnings: z
    .array(z.string())
    .describe('Anything unreadable, cut off, or ambiguous in the source. Empty when the material is clean.'),
})
export type Extraction = z.infer<typeof ExtractionSchema>

export const GeneratedQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).describe('Exactly four answer choices.'),
  correctAnswer: z.number().describe('Zero-based index of the single correct option.'),
  explanation: z.string().describe('Why the correct option is right and the others are not.'),
  evidence: z
    .string()
    .describe('A verbatim quote copied from the source that proves the answer. Never paraphrase here.'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>

export const GeneratedFlashcardSchema = z.object({
  front: z.string().describe('The prompt side - a term or question.'),
  back: z.string().describe('The answer side, in one or two sentences.'),
  evidence: z.string().describe('A verbatim quote from the source that supports the back of the card.'),
})
export type GeneratedFlashcard = z.infer<typeof GeneratedFlashcardSchema>

export const GeneratedIdentificationSchema = z.object({
  prompt: z
    .string()
    .describe('The clue: a definition or description taken from the source, with the term itself removed.'),
  answer: z.string().describe('The exact term the source uses. A word or short phrase, never a sentence.'),
  acceptedAnswers: z
    .array(z.string())
    .describe('Other wordings the source itself uses for the same thing. Empty when the source gives only one.'),
  evidence: z.string().describe('A verbatim quote from the source that names the term and its meaning.'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})
export type GeneratedIdentification = z.infer<typeof GeneratedIdentificationSchema>

export const StudyPackSchema = z.object({
  title: z.string(),
  description: z.string().describe('One sentence describing what this set covers.'),
  language: z.string(),
  notes: z
    .string()
    .describe('Structured revision notes in markdown, faithful to the source and written in its language.'),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })),
  flashcards: z.array(GeneratedFlashcardSchema),
  questions: z.array(GeneratedQuestionSchema),
  identifications: z.array(GeneratedIdentificationSchema),
})
export type StudyPack = z.infer<typeof StudyPackSchema>

export const ReviewSchema = z.object({
  identificationReviews: z.array(
    z.object({
      index: z.number().describe('Index of the identification item being reviewed, as given in the list.'),
      verdict: z.enum(['ok', 'fix', 'drop']),
      answer: z.string().describe('The term the clue actually points to.'),
      issue: z.string().describe('What was wrong. Empty string when the verdict is "ok".'),
    })
  ),
  reviews: z.array(
    z.object({
      index: z.number().describe('Index of the question being reviewed, as given in the list.'),
      verdict: z.enum(['ok', 'fix', 'drop']),
      correctAnswer: z.number().describe('The index of the option that is actually correct.'),
      explanation: z.string().describe('The explanation to use, corrected if needed.'),
      issue: z.string().describe('What was wrong. Empty string when the verdict is "ok".'),
    })
  ),
})
export type Review = z.infer<typeof ReviewSchema>['reviews'][number]

export const SolutionSchema = z.object({
  problemText: z
    .string()
    .describe('The problem exactly as it appears in the source, so the student can confirm it was read correctly.'),
  subject: z.string(),
  steps: z.array(
    z.object({
      title: z.string().describe('Short label for this step.'),
      detail: z.string().describe('The work for this step, with the reasoning made explicit.'),
    })
  ),
  finalAnswer: z.string(),
  check: z.string().describe('An independent check of the answer - substitute back, estimate, or verify units.'),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z
    .array(z.string())
    .describe('Unreadable text, missing information, or assumptions that had to be made. Empty when there are none.'),
})
export type Solution = z.infer<typeof SolutionSchema>
