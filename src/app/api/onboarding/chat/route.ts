import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, jsonError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/admin";
import { AiUnavailableError } from "@/lib/ai/claude";
import { onboardingTurn, type ChatMessage } from "@/lib/ai/quest";
import { hasServerEnv } from "@/lib/env";

const MAX_USER_TURNS = 24;
const body = z.object({ message: z.string().trim().min(1).max(1000) });

// The conversation lives server-side, so the client can't forge assistant turns.
export async function POST(request: Request) {
  if (!hasServerEnv("ANTHROPIC_API_KEY")) return jsonError(503, "ai_unavailable");

  const { user, response } = await authorize("onboarding-chat");
  if (!user) return response;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "ההודעה ריקה או ארוכה מדי");

  const db = createServiceClient();
  const { data: session } = await db.from("onboarding_sessions").select("messages").eq("user_id", user.id).maybeSingle();
  const history = ((session?.messages as ChatMessage[] | undefined) ?? []).slice(-60);

  if (history.filter((m) => m.role === "user").length >= MAX_USER_TURNS) {
    return jsonError(400, "השיחה ארוכה מדי — אפשר לסיים עם המטרות שכבר הוגדרו");
  }

  const nextHistory: ChatMessage[] = [...history, { role: "user", content: parsed.data.message }];
  try {
    const turn = await onboardingTurn(nextHistory);
    const saved: ChatMessage[] = [...nextHistory, { role: "assistant", content: turn.reply }];
    await db.from("onboarding_sessions").upsert({
      user_id: user.id,
      messages: saved,
      draft: { goals: turn.goals, ready: turn.ready },
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json(turn);
  } catch (error) {
    if (error instanceof AiUnavailableError) return jsonError(503, "ai_unavailable");
    throw error;
  }
}

/** Start over: clear the conversation. */
export async function DELETE() {
  const { user, response } = await authorize();
  if (!user) return response;
  await createServiceClient().from("onboarding_sessions").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
