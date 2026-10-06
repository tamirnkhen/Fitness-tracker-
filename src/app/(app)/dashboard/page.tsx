import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Chevrons } from "@/components/brand/Logo";
import { DomainBreakdown } from "@/components/DomainBreakdown";
import { QuestBoard } from "@/components/quest/QuestBoard";
import { requireActiveProfile } from "@/lib/auth";
import { getCharacter, signedAvatarUrl } from "@/lib/character";
import { countCompletedTasks, getCurrentTasks, getDomainBreakdown, syncQuests } from "@/lib/quests";

export const metadata: Metadata = { title: "משימות" };

export default async function DashboardPage() {
  const profile = await requireActiveProfile();
  const { today, week } = await syncQuests(profile);
  const [tasks, character, breakdown, completed] = await Promise.all([
    getCurrentTasks(profile.id, today, week),
    getCharacter(profile.id),
    getDomainBreakdown(profile.id),
    countCompletedTasks(profile.id),
  ]);
  const avatarUrl = await signedAvatarUrl(character);

  return (
    <>
      <header className="mb-5 flex items-center gap-4">
        <Link href="/character" className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-line-strong bg-card" aria-label="הדמות שלי">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={`הדמות של ${profile.display_name ?? "השחקן/ית"}`} fill sizes="64px" className="object-cover object-top" unoptimized />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Chevrons size={30} />
            </span>
          )}
        </Link>
        <div className="min-w-0">
          <p className="text-sm text-muted">ברוך/ה הבא/ה,</p>
          <h1 className="truncate text-2xl font-black">{profile.display_name || "שחקן/ית"}</h1>
        </div>
      </header>

      <QuestBoard tasks={tasks} xpTotal={profile.xp_total} tasksCompleted={completed} firstRun={completed === 0} />

      {!character?.avatar_path && (
        <Link
          href="/character"
          className="mb-7 flex items-center gap-4 rounded-2xl border border-line bg-card p-4 transition hover:border-amber"
        >
          <Chevrons size={28} />
          <span className="flex-1">
            <span className="block font-medium">צור/י את הדמות שלך</span>
            <span className="text-sm text-muted">דמות מצוירת שמשתדרגת יחד איתך</span>
          </span>
          <span aria-hidden="true" className="text-amber">
            ←
          </span>
        </Link>
      )}

      <DomainBreakdown totals={breakdown} />
    </>
  );
}
