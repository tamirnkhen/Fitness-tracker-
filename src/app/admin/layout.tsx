import type { Metadata } from "next";
import Link from "next/link";
import { LogoLockup } from "@/components/brand/Logo";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Control Center", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Non-admins get a 404. Each page and data call re-checks the role as well.
  await requireAdmin();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <LogoLockup size="sm" />
          <span className="rounded-full border border-amber-dim px-2.5 py-0.5 text-xs text-amber">Control Center</span>
        </div>
        <nav className="flex gap-4 text-sm" aria-label="ניווט ניהול">
          <Link href="/admin" className="text-body hover:text-cream">
            משתמשים ומדדים
          </Link>
          <Link href="/admin/audit" className="text-body hover:text-cream">
            יומן צפיות
          </Link>
          <Link href="/dashboard" className="text-muted hover:text-cream">
            חזרה לאפליקציה
          </Link>
        </nav>
      </header>
      <p className="mb-6 rounded-xl border border-line bg-card px-4 py-2.5 text-xs leading-5 text-muted">
        צפייה בלבד. כל צפייה ברשימת המשתמשים או בפרטי משתמש נרשמת ביומן הצפיות (מי, מה, מתי).
      </p>
      {children}
    </div>
  );
}
