import type { Metadata } from "next";
import { CharacterStudio, PhotoConsent } from "@/components/character/CharacterStudio";
import { Chevrons } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { getCharacter, signedAvatarUrl } from "@/lib/character";
import { hasServerEnv } from "@/lib/env";

export const metadata: Metadata = { title: "הדמות שלך" };

// Optional last onboarding step — skippable so the first quest is never more
// than a tap away.
export default async function OnboardingCharacterPage() {
  const profile = await requireActiveProfile();
  const character = await getCharacter(profile.id);
  const avatarUrl = await signedAvatarUrl(character);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.2em] text-amber">שלב 3 מתוך 3 · לא חובה</p>
        <Chevrons size={26} />
      </header>
      <div>
        <h1 className="text-2xl font-black">המסע מוכן. עכשיו — הדמות.</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          העלה/י תמונה וניצור ממנה דמות מצוירת שמשתדרגת איתך. אפשר גם לדלג ולעשות את זה אחר כך.
        </p>
      </div>

      {profile.photo_consent_at ? (
        <CharacterStudio
          avatarUrl={avatarUrl}
          hasSource={Boolean(character?.source_path)}
          status={character?.status ?? "none"}
          generationAvailable={hasServerEnv("OPENAI_API_KEY")}
        />
      ) : (
        <PhotoConsent />
      )}

      <ButtonLink href="/dashboard?welcome=1" variant={avatarUrl ? "primary" : "ghost"} className="mt-auto">
        {avatarUrl ? "למשימה הראשונה ←" : "דלג/י — קדימה למשימה הראשונה"}
      </ButtonLink>
    </main>
  );
}
