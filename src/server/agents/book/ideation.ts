// ─── Book Engine: Ideation Agent ─────────────────────────────────────────────
import type { BookProposal } from '@gezy/sdk';
import { bookProposalSchema } from '@gezy/sdk';

/** Output from the IdeationAgent */
export type IdeationAgentOutput = BookProposal;

/** Context passed to the agent */
export interface IdeationContext {
  userIntent: string;
  knowledgeBaseIds: string[];
  kbSummaries: string;
  language: string;
}

const SYSTEM_PROMPT = `You are a curriculum designer and textbook architect. Based on the user's intent and available knowledge base materials, propose ONE coherent book.

Rules:
- Title must be clear and descriptive (max 120 chars)
- Description should explain what the reader will learn
- Scope defines what IS and IS NOT covered
- Target level: "beginner", "intermediate", "advanced", or "mixed"
- Estimated chapters: 4-8
- Rationale should explain WHY this structure works pedagogically

Output ONLY a JSON object with no markdown fences.`;

const USER_PROMPT_TEMPLATE = `User Intent: {userIntent}

Knowledge Bases ({kbCount} total): {kbSummaries}

Language: {language}

Propose a book that satisfies this intent. Respond with JSON only.`;

/**
 * Build the prompts and generate a BookProposal via LLM.
 *
 * This is the call site. In production, the caller injects the LLM
 * function so we stay provider-agnostic.
 */
export async function generateProposal(
  ctx: IdeationContext,
  callLLM: (systemPrompt: string, userPrompt: string) => Promise<string>,
): Promise<BookProposal> {
  const systemPrompt = SYSTEM_PROMPT + (ctx.language !== 'en'
    ? `\n\nRespond in ${ctx.language}. Title and description must be in ${ctx.language}.`
    : '');

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{userIntent}', ctx.userIntent)
    .replace('{kbCount}', String(ctx.knowledgeBaseIds.length))
    .replace('{kbSummaries}', ctx.kbSummaries || 'No knowledge bases selected.')
    .replace('{language}', ctx.language);

  const raw = await callLLM(systemPrompt, userPrompt);

  // Parse JSON from LLM output (handle markdown code fences)
  let json = raw.trim();
  if (json.startsWith('```')) {
    const end = json.lastIndexOf('```');
    json = json.slice(json.indexOf('\n') + 1, end).trim();
  }

  const parsed = JSON.parse(json);
  return bookProposalSchema.parse(parsed);
}

/**
 * Generate a simple summary of KB contents for the ideation prompt.
 * This is a lightweight version — the full explorer is in the RAG service.
 */
export function summarizeKBs(knowledgeBaseIds: string[]): string {
  if (knowledgeBaseIds.length === 0) return 'No knowledge bases selected. The book will be generated from general knowledge.';

  return `Selected knowledge bases: ${knowledgeBaseIds.join(', ')}.
The spine agent will explore these in detail. For ideation, assume these contain relevant educational material.`;
}
