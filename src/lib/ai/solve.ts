import { getProvider } from './client'
import type { Part } from './provider'
import { SolutionSchema, type Solution } from './schemas'

const SOLVE_SYSTEM = `You are a patient tutor working through one problem with a student who has to be able to redo it alone tomorrow.

Read the problem first and write it back in problemText exactly as it appears, including the numbers and units. If it came from a photo and part of it is blurred, cropped, or ambiguous, say so in warnings and solve the most reasonable reading rather than inventing missing values.

Then solve it:
- One step per actual move. Every step names the rule, formula, or definition being used and shows the substitution, not just the result.
- Explain why the step is the right move, not only what it is. The student is learning the method.
- Keep units attached throughout, and keep the student's language: if the problem is written in Filipino, Bisaya, or Hiligaynon, teach in that language.
- Write mathematics in plain Unicode (x², √9, ≤, π, 3/4, ×). Never emit LaTeX or backslash commands.
- Never use emoji or decorative symbols. Plain words, numbers, and standard punctuation only.

Then verify. In "check", confirm the answer independently - substitute it back into the original equation, re-derive it another way, sanity-check the magnitude, or confirm the units. If the check fails, fix the solution before answering.

Confidence must be honest: "high" only when the problem is fully legible and the check passes, "low" when you had to guess at the problem or the method is uncertain. Never present a guess as a solved problem.`

export async function solveProblem(parts: Part[], subject: string): Promise<Solution> {
  const subjectLine =
    subject && subject !== 'general'
      ? `The student says this is a ${subject} problem.`
      : 'The student did not say which subject this is - work it out from the problem.'

  return getProvider().structured({
    label: 'solution',
    schema: SolutionSchema,
    system: SOLVE_SYSTEM,
    // Correctness matters more than cost on a problem the student will copy down.
    effort: 'deep',
    parts: [...parts, { kind: 'text', text: `${subjectLine} Solve it step by step.` }],
  })
}
