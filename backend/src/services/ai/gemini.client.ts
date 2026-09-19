import { GoogleGenerativeAI } from '@google/generative-ai';
import { env, isGeminiConfigured } from '../../config/env';
import { SYSTEM_INSTRUCTION, buildUserPrompt, type InvestigationContext } from './prompt';
import { decisionSchema, geminiResponseSchema, type AiDecision } from './schemas';

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!isGeminiConfigured()) throw new Error('Gemini API key is not configured');
  client ??= new GoogleGenerativeAI(env.geminiApiKey);
  return client;
}

/**
 * Asks Gemini for a structured decision. The model returns JSON only; it has no
 * tools, no database handle and no network reach of its own. Its output is
 * parsed against a strict schema before anything downstream sees it.
 */
export async function requestDecision(ctx: InvestigationContext): Promise<AiDecision> {
  const model = getClient().getGenerativeModel({
    model: env.geminiModel,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: geminiResponseSchema as any,
    },
  });

  const result = await model.generateContent(buildUserPrompt(ctx));
  const text = result.response.text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned a response that was not valid JSON');
  }

  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Gemini response failed schema validation: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`
    );
  }
  return parsed.data;
}
