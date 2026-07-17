// ─── Book Engine: Spine Synthesizer Agent ─────────────────────────────────────
import type { BookProposal, Spine, SourceChunk, Chapter, ConceptGraph } from '@gezy/sdk';
import { spineSchema } from '@gezy/sdk';
import { v7 as uuid } from 'uuid';

const SYSTEM_PROMPT = `You are a textbook architect. Given an approved book proposal and source materials, design the detailed chapter structure and concept graph.

Rules:
1. Each chapter must have: id (UUID), title, order (0-based), learningObjectives (2-4), contentTypes (from: text, quiz, callout, figure), pageIds (empty for now)
2. The concept graph must show prerequisite relationships between concepts across chapters
3. Ensure all learning objectives are covered by chapters
4. Chapters must follow a logical pedagogical progression
5. Concept graph nodes must reference the chapter they belong to

Output ONLY a JSON object with no markdown fences.`;

const USER_PROMPT_TEMPLATE = `Book Proposal:
{proposal}

Source Materials Summary:
{sourceSummary}

Language: {language}

Design the complete spine (chapters + concept graph).`;

/**
 * Synthesize the spine from proposal + source chunks.
 *
 * For simplicity, this is a single LLM call. In production, you'd add
 * critique→revise rounds as the implementation plan specifies.
 */
export async function synthesizeSpine(
  proposal: BookProposal,
  sourceChunks: SourceChunk[],
  language: string,
  callLLM: (systemPrompt: string, userPrompt: string) => Promise<string>,
  onRound?: (label: string, payload: Record<string, unknown>) => void,
): Promise<Spine> {
  const systemPrompt = SYSTEM_PROMPT + (language !== 'en'
    ? `\n\nAll titles, objectives, and concept labels must be in ${language}.`
    : '');

  const sourceSummary = sourceChunks.length > 0
    ? sourceChunks.slice(0, 10).map(c => `[${c.kbId}] ${c.text.substring(0, 300)}...`).join('\n\n')
    : 'No source materials available. Design from general knowledge.';

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{proposal}', JSON.stringify(proposal, null, 2))
    .replace('{sourceSummary}', sourceSummary)
    .replace('{language}', language);

  if (onRound) onRound('draft', { phase: 'synthesis' });

  const raw = await callLLM(systemPrompt, userPrompt);

  // Parse JSON
  let json = raw.trim();
  if (json.startsWith('```')) {
    const end = json.lastIndexOf('```');
    json = json.slice(json.indexOf('\n') + 1, end).trim();
  }

  const parsed = JSON.parse(json);

  // Build spine with proper IDs
  const proposalBookId = 'spine-from-proposal';
  const chapters: Chapter[] = (parsed.chapters || []).map((ch: any, idx: number) => ({
    id: ch.id || uuid(),
    title: ch.title || `Chapter ${idx + 1}`,
    order: ch.order ?? idx,
    learningObjectives: ch.learningObjectives || [],
    contentTypes: ch.contentTypes || ['text', 'quiz'],
    pageIds: ch.pageIds || [],
  }));

  const conceptGraph: ConceptGraph = {
    nodes: (parsed.concept_graph?.nodes || []).map((n: any) => ({
      id: n.id || uuid(),
      label: n.label || n.id || '',
      chapterId: n.chapter_id || n.chapterId,
    })),
    edges: (parsed.concept_graph?.edges || []).map((e: any) => ({
      source: e.source,
      target: e.target,
      label: e.label,
    })),
  };

  const spine: Spine = {
    bookId: proposalBookId, // Will be replaced by caller
    chapters,
    conceptGraph,
  };

  // Validate
  spineSchema.parse(spine);

  return spine;
}
