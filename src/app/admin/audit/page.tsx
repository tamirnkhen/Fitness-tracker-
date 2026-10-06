import Link from "next/link";
import { getAuditLog } from "@/lib/admin";

const fmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Jerusalem" });

const ACTIONS: Record<string, string> = {
  view_user_list: "צפייה ברשימת משתמשים",
  view_user: "צפייה בפרטי משתמש",
  view_audit_log: "צפייה ביומן",
};

export default async function AuditPage() {
  const entries = await getAuditLog();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-black">יומן צפיות</h1>
      <p className="mb-5 text-sm text-muted">רשומות נשמרות לצמיתות ואינן ניתנות לעריכה או למחיקה (נאכף במסד הנתונים).</p>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-card text-xs text-muted">
            <tr>
              <th className="px-4 py-3 text-start font-medium">מתי</th>
              <th className="px-4 py-3 text-start font-medium">מי (admin id)</th>
              <th className="px-4 py-3 text-start font-medium">פעולה</th>
              <th className="px-4 py-3 text-start font-medium">משתמש יעד</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-4 py-2.5 whitespace-nowrap text-body">{fmt.format(new Date(e.created_at))}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted" dir="ltr">
                  {e.admin_id.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5">
                  {ACTIONS[e.action] ?? e.action}
                  {e.details?.search ? <span className="text-xs text-muted"> · &quot;{String(e.details.search)}&quot;</span> : null}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs" dir="ltr">
                  {e.target_user_id ? (
                    <Link href={`/admin/users/${e.target_user_id}`} className="text-amber underline">
                      {e.target_user_id.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
