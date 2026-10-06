import { BottomNav } from "@/components/BottomNav";
import { requireActiveProfile } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Pages re-check on their own too (layouts don't re-render on every navigation).
  const profile = await requireActiveProfile();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <main className="flex-1 px-4 pt-5 pb-28">{children}</main>
      <BottomNav isAdmin={profile.role === "admin"} />
    </div>
  );
}
