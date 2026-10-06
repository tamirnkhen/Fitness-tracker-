"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DailyIcon, MilestoneIcon, WeeklyIcon } from "@/components/brand/icons";

function PersonIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="15" r="8" fill="none" stroke="#D9A441" strokeWidth="3" />
      <path d="M9 43c1.5-9 7.5-14 15-14s13.5 5 15 14" fill="none" stroke="#D9A441" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="7" fill="none" stroke="#D9A441" strokeWidth="3" />
      <path
        d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2"
        stroke="#D9A441"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ITEMS = [
  { href: "/dashboard", label: "משימות", icon: <DailyIcon size={22} /> },
  { href: "/history", label: "היסטוריה", icon: <WeeklyIcon size={22} /> },
  { href: "/character", label: "הדמות", icon: <PersonIcon /> },
  { href: "/settings", label: "הגדרות", icon: <GearIcon /> },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...ITEMS, { href: "/admin", label: "ניהול", icon: <MilestoneIcon size={22} /> }] : ITEMS;
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] transition ${
                  active ? "text-cream" : "text-muted opacity-70 hover:opacity-100"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
