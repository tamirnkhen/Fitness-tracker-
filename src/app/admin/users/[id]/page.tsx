import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DomainIcon } from "@/components/brand/icons";
import { getAdminUserDetail } from "@/lib/admin";
import { domainLabel, isDomain } from "@/lib/game/domains";
import { levelProgress } from "@/lib/game/levels";

const fmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" });

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const d = await getAdminUserDetail(id);
  if (!d.user) notFound();
  const p = levelProgress(d.user.xp_total);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-sm text-muted hover:text-cream">
        → חזרה לרשימה
      </Link>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h1 className="text-2xl font-black">{d.user.display_name || "—"}</h1>
        <p className="text-sm text-muted" dir="ltr">
          {d.user.email}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">הרשמה</dt>
            <dd>{fmt.format(new Date(d.user.created_at))}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">פעילות אחרונה</dt>
            <dd>{d.user.last_active_at ? fmt.format(new Date(d.user.last_active_at)) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">רמה · XP</dt>
            <dd className="font-display" dir="ltr">
              LVL {p.level} · {d.user.xp_total} XP
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">ימים פעילים (30)</dt>
            <dd className="font-display">{d.activeDays30}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">משימות שהושלמו</dt>
            <dd className="font-display">{d.counts.done}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">פגו בלי ביצוע</dt>
            <dd className="font-display">{d.counts.expired}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">פתוחות כרגע</dt>
            <dd className="font-display">{d.counts.open}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">דמות</dt>
            <dd>{d.character ? `${d.character.status} · ${d.character.generation_count} יצירות` : "לא נוצרה"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">תמונות המשתמש והדמות אינן נגישות בפאנל הניהול.</p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 text-lg font-bold">מטרות</h2>
        <ul className="flex flex-col gap-3">
          {d.goals.map((g) => (
            <li key={g.id} className={`flex gap-3 ${g.status === "archived" ? "opacity-50" : ""}`}>
              {isDomain(g.domain) && <DomainIcon domain={g.domain} size={20} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-medium">
                  {g.title} {g.status === "archived" && <span className="text-xs text-muted">(בארכיון)</span>}
                </p>
                <p className="text-xs text-muted">
                  {isDomain(g.domain) ? domainLabel(g.domain, g.custom_label) : g.domain} · היום: {g.baseline || "—"} · יעד: {g.target || "—"}
                </p>
              </div>
            </li>
          ))}
          {d.goals.length === 0 && <li className="text-sm text-muted">אין מטרות</li>}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 text-lg font-bold">XP אחרון</h2>
        <ul className="flex flex-col divide-y divide-line text-sm">
          {d.recentXp.map((e) => (
            <li key={e.id} className="flex justify-between py-2">
              <span className="text-body">{isDomain(e.domain) ? domainLabel(e.domain) : e.domain}</span>
              <span className="text-muted">{fmt.format(new Date(e.created_at))}</span>
              <span className="font-display font-bold text-amber" dir="ltr">
                +{e.amount}
              </span>
            </li>
          ))}
          {d.recentXp.length === 0 && <li className="py-2 text-muted">אין עדיין</li>}
        </ul>
      </section>
    </div>
  );
}
