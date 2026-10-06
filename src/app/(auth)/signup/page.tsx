import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";

export const metadata: Metadata = { title: "הרשמה" };

export default async function SignupPage() {
  if (await getUser()) redirect("/dashboard");

  return (
    <AuthShell
      title="מתחילים את המסע"
      footer={
        <>
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-medium text-amber">
            כניסה
          </Link>
          <p className="mt-4 text-xs leading-5">
            ההרשמה מיועדת לבני 18 ומעלה. בהמשך נבקש ממך לאשר את{" "}
            <Link href="/terms" className="underline">
              תנאי השימוש
            </Link>{" "}
            ואת{" "}
            <Link href="/privacy" className="underline">
              מדיניות הפרטיות
            </Link>
            .
          </p>
        </>
      }
    >
      <AuthForm mode="signup" next="/onboarding" />
    </AuthShell>
  );
}
