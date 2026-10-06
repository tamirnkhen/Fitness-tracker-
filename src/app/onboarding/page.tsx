import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chevrons } from "@/components/brand/Logo";
import { getProfile, needsOnboarding, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServerEnv } from "@/lib/env";
import { sanitizeGoals } from "@/lib/ai/quest";
import type { ChatMessage } from "@/lib/ai/quest";
import { ConsentForm } from "./ConsentForm";
import { QuestSetup } from "./QuestSetup";

export const metadata: Metadata = { title: "יוצאים למסע" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const stage = needsOnboarding(profile);
  const redo = params.redo === "1";
  if (!stage && !redo) redirect("/dashboard");

  if (stage === "consent") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
        <Chevrons size={40} className="mb-6 self-center" />
        <p className="mb-1 text-center text-xs font-semibold tracking-[0.2em] text-amber">שלב 1 מתוך 3</p>
        <h1 className="mb-2 text-center text-2xl font-black">לפני שמתחילים</h1>
        <p className="mb-8 text-center text-sm leading-6 text-muted">שני פרטים קטנים, ואז יוצאים לדרך.</p>
        <ConsentForm defaultName={profile.display_name ?? ""} />
      </main>
    );
  }

  const supabase = await createClient();
  const { data: session } = await supabase.from("onboarding_sessions").select("messages, draft").eq("user_id", profile.id).maybeSingle();
  const draft = (session?.draft ?? {}) as { goals?: unknown[]; ready?: boolean };

  return (
    <QuestSetup
      name={profile.display_name ?? ""}
      aiEnabled={hasServerEnv("ANTHROPIC_API_KEY")}
      initialMessages={(session?.messages as ChatMessage[] | undefined) ?? []}
      initialGoals={sanitizeGoals(draft.goals ?? [])}
      initialReady={Boolean(draft.ready)}
      isRedo={redo}
    />
  );
}
