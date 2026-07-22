// Part 3 — Owner AI Assistant helpers. Wraps the existing rule-based
// `answerOwnerQuery` engine (src/lib/pnl.ts). Fully offline, no external API.
// Kept separate so the UI route stays thin.

import { answerOwnerQuery, type AssistantContext, type AssistantAnswer } from "@/lib/pnl";

export type { AssistantContext, AssistantAnswer };

// Suggested questions shown as quick-tap chips in the assistant UI.
export const SUGGESTED_QUESTIONS = [
  "How much oxygen is remaining?",
  "What is today's profit?",
  "What is this month's profit?",
  "Which customer owes the most?",
  "Which vehicle has the highest expense?",
  "What is the best selling gas?",
  "How much is outstanding?",
] as const;

export function ask(question: string, ctx: AssistantContext): AssistantAnswer {
  return answerOwnerQuery(question, ctx);
}
