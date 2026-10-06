import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { requireServerEnv } from "@/lib/env";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export class AiUnavailableError extends Error {}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: requireServerEnv("ANTHROPIC_API_KEY"), maxRetries: 2, timeout: 60_000 });
  return client;
}

/**
 * One structured-output call. The response is validated against `schema` by the SDK;
 * callers still clamp numeric ranges since JSON-schema constraints are not enforced.
 * `fallbacks: "default"` lets the API retry a safety-declined request on its
 * recommended fallback model instead of failing the user's onboarding.
 */
export async function structuredCall<S extends z.ZodType>(params: {
  schema: S;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: params.maxTokens ?? 8000,
      system: params.system,
      messages: params.messages,
      thinking: { type: "adaptive" },
      output_config: { effort: params.effort, format: betaZodOutputFormat(params.schema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AiUnavailableError("rate_limited");
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      throw new AiUnavailableError("api_error");
    }
    throw error;
  }

  if (response.stop_reason === "refusal") throw new AiUnavailableError("refusal");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new AiUnavailableError("incomplete");
  return response.parsed_output as z.infer<S>;
}
