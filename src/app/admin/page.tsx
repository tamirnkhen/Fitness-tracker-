import Link from "next/link";
import { inputClass } from "@/components/ui";
import { getAdminOverview } from "@/lib/admin";

const dateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Jerusalem" });
const relFmt = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

function relative(iso: string | null) {
  if (!iso) return "—";
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days === 0) return "היום";
  return relFmt.format(days, "day");
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-cream" dir="ltr">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const { metrics: m, users } = await getAdminOverview(q);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="metrics">
        <h1 id="metrics" className="mb-4 text-2xl font-black">
          מדדים
        </h1>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="משתמשים" value={m.total_users} hint={`${m.new_users_7d} חדשים ב-7 ימים`} />
          <Stat label="פעילים היום (DAU)" value={m.dau} />
          <Stat label="פעילים השבוע (WAU)" value={m.wau} hint={`MAU: ${m.mau}`} />
          <Stat
            label="שיעור נטישה שבועי"
            value={m.churn_rate === null ? "—" : `${Math.round(m.churn_rate * 100)}%`}
            hint={`${m.churned} מתוך ${m.prev_week_active} שהיו פעילים שבוע שעבר`}
          />
          <Stat label="משימות שהושלמו (7 ימים)" value={m.tasks_done_7d} />
          <Stat label="ממוצע משימות למשתמש פעיל" value={m.avg_tasks_per_active_user_7d} hint="7 ימים אחרונים" />
          <Stat label="סיימו onboarding" value={m.onboarded_users} hint={m.total_users ? `${Math.round((m.onboarded_users / m.total_users) * 100)}%` : undefined} />
        </div>
      </section>

      <section aria-labelledby="users">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="users" className="text-2xl font-black">
            משתמשים
          </h2>
          <form className="flex w-full gap-2 sm:w-auto" role="search">
            <label htmlFor="q" className="sr-only">
              חיפוש לפי אימייל או שם
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="חיפוש אימייל / שם" className={`${inputClass} sm:w-64`} />
          </form>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-card text-xs text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">משתמש</th>
                <th className="px-4 py-3 text-start font-medium">הרשמה</th>
                <th className="px-4 py-3 text-start font-medium">רמה</th>
                <th className="px-4 py-3 text-start font-medium">פעילות אחרונה</th>
                <th className="px-4 py-3 text-start font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line hover:bg-card/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="block">
                      <span className="block font-medium text-cream">{u.display_name || "—"}</span>
                      <span className="text-xs text-muted" dir="ltr">
                        {u.email}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-body">{dateFmt.format(new Date(u.created_at))}</td>
                  <td className="px-4 py-3 font-display font-bold text-amber" dir="ltr">
                    {u.level}
                  </td>
                  <td className="px-4 py-3 text-body">{relative(u.last_active_at)}</td>
                  <td className="px-4 py-3 text-xs">
                    {u.role === "admin" ? <span className="text-amber">admin</span> : u.onboarding_completed_at ? <span className="text-success">פעיל</span> : <span className="text-muted">באונבורדינג</span>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    לא נמצאו משתמשים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
