import type { Metadata } from "next";
import { CharacterStudio, PhotoConsent } from "@/components/character/CharacterStudio";
import { GearPicker } from "@/components/character/GearPicker";
import { Button } from "@/components/ui";
import { XpBar } from "@/components/XpBar";
import { requireActiveProfile } from "@/lib/auth";
import { getCharacter, signedAvatarUrl } from "@/lib/character";
import { hasServerEnv } from "@/lib/env";
import { GEAR, isUnlocked } from "@/lib/game/gear";
import { countCompletedTasks } from "@/lib/quests";
import { withdrawPhotoConsent } from "./actions";

export const metadata: Metadata = { title: "הדמות" };

export default async function CharacterPage() {
  const profile = await requireActiveProfile();
  const [character, tasksCompleted] = await Promise.all([getCharacter(profile.id), countCompletedTasks(profile.id)]);
  const avatarUrl = await signedAvatarUrl(character);
  const stats = { level: profile.level, tasksCompleted };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black">הדמות שלך</h1>
        <p className="mt-1 text-sm text-muted">מתחילה בלבוש בסיסי, ומשתדרגת ככל שאת/ה מתקדם/ת.</p>
      </header>

      <XpBar xpTotal={profile.xp_total} />

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

      <GearPicker unlockedIds={GEAR.filter((g) => isUnlocked(g, stats)).map((g) => g.id)} equipped={character?.equipped ?? []} />

      {profile.photo_consent_at && (
        <form action={withdrawPhotoConsent} className="rounded-2xl border border-line p-5">
          <h2 className="mb-1 font-bold">מחיקת התמונות</h2>
          <p className="mb-3 text-sm text-muted">מוחק את התמונה המקורית ואת הדמות שנוצרה ממנה, ומבטל את ההסכמה. ההתקדמות שלך נשמרת.</p>
          <Button type="submit" variant="danger">
            מחיקת התמונה והדמות
          </Button>
        </form>
      )}
    </div>
  );
}
