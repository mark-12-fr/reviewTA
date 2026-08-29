export type MasteryStatus = 'unfamiliar' | 'learning' | 'familiar' | 'mastered'

export interface ProgressCounts {
  unfamiliar: number
  learning: number
  familiar: number
  mastered: number
  totalItems: number
}

export interface StudySetSummary {
  id: string
  title: string
  description?: string | null
  sourceType: string
  sourceName?: string | null
  status: string
  folderId?: string | null
  createdAt: string
  updatedAt: string
  progress: ProgressCounts
  counts: {
    questions: number
    identifications: number
    flashcards: number
  }
}

export type QuestionKind = 'mcq' | 'identification'

export interface Question {
  id: string
  kind: QuestionKind
  /** The question stem, or the clue for an identification item. */
  question: string
  options: string[]
  correctAnswer: number
  /** Identification only: the term the student has to type. */
  answer?: string | null
  /** Identification only: other wordings the source itself gives. */
  accepted: string[]
  explanation?: string | null
  evidence?: string | null
  verified: boolean
  difficulty: string
  status: MasteryStatus
}

export interface Flashcard {
  id: string
  front: string
  back: string
  evidence?: string | null
  verified: boolean
  status: MasteryStatus
}

export interface StudySetDetail {
  id: string
  title: string
  description?: string | null
  notes?: string | null
  keyTerms: Array<{ term: string; definition: string }>
  sourceContent?: string | null
  sourceType: string
  sourceName?: string | null
  status: string
  generatedBy?: string | null
  folderId?: string | null
  createdAt: string
  updatedAt: string
  progress: ProgressCounts
  questions: Question[]
  flashcards: Flashcard[]
}

export interface Folder {
  id: string
  name: string
  color: string
  createdAt?: string
  studySetCount: number
}

export interface SolutionStep {
  title: string
  detail: string
}

export interface Solution {
  id: string
  problemText: string
  subject: string
  steps: SolutionStep[]
  finalAnswer: string
  check: string
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export function masteryPercentage(progress: ProgressCounts | null | undefined): number {
  if (!progress || progress.totalItems === 0) return 0
  // Partial credit up the ladder, so studying shows movement before mastery.
  const weighted = progress.learning * 0.34 + progress.familiar * 0.67 + progress.mastered
  return Math.round((weighted / progress.totalItems) * 100)
}
