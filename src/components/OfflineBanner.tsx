"use client";
import { useOffline } from "next/offline";

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-card-raised px-4 py-2 text-center text-sm text-amber">
      אין חיבור לרשת — נמשיך מאיפה שעצרת ברגע שהחיבור יחזור
    </div>
  );
}
