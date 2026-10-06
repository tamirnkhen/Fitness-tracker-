import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { DomainIcon } from "@/components/brand/icons";
import { Button, ButtonLink, Card } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { domainLabel } from "@/lib/game/domains";
import { createClient } from "@/lib/supabase/server";
import type { Goal } from "@/lib/types";
import { DeleteAccount } from "./DeleteAccount";

export const metadata: Metadata = { title: "הגדרות" };

export default async function SettingsPage() {
  const profile = await requireActiveProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("goals").select("*").eq("user_id", profile.id).eq("status", "active").order("created_at");
  const goals = (data ?? []) as Goal[];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-black">הגדרות</h1>

      <Card>
        <h2 className="mb-3 text-lg font-bold">המטרות שלך</h2>
        <ul className="mb-4 flex flex-col gap-3">
          {goals.map((g) => (
            <li key={g.id} className="flex gap-3">
              <DomainIcon domain={g.domain} size={22} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{g.title}</p>
                <p className="text-xs text-muted">
                  {domainLabel(g.domain, g.custom_label)} · היום: {g.baseline || "—"} · יעד: {g.target || "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <ButtonLink href="/onboarding?redo=1" variant="secondary" className="w-full">
          הגדרת מטרות מחדש
        </ButtonLink>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">פרטיות ומסמכים</h2>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/privacy" className="text-amber underline">
            מדיניות פרטיות
          </Link>
          <Link href="/terms" className="text-amber underline">
            תנאי שימוש
          </Link>
          <Link href="/character" className="text-amber underline">
            ניהול התמונה והדמות
          </Link>
        </div>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          התנתקות
        </Button>
      </form>

      <Card className="border-danger/30">
        <h2 className="mb-2 text-lg font-bold">מחיקת חשבון</h2>
        <DeleteAccount />
      </Card>
    </div>
  );
}
