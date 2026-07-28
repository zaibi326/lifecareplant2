// Part 4 — Smart ERP Assistant helpers. Wraps rule-based
// intent matching engine. Fully offline, instant, zero external API latency.

import { answerOwnerQuery, type AssistantContext, type AssistantAnswer } from "@/lib/pnl";

export type { AssistantContext, AssistantAnswer };

export const SUGGESTED_QUESTIONS = [
  "Today's production",
  "Customer Ali balance",
  "Which customer has highest due?",
  "Show low stock",
  "Which supplier has pending payment?",
  "Print today's report",
  "Open production",
  "Open customer statement",
] as const;

export function ask(question: string, ctx: AssistantContext): AssistantAnswer {
  return answerOwnerQuery(question, ctx);
}
