import type { Metadata, Viewport } from "next";
import { Poppins, Rubik } from "next/font/google";
import { headers } from "next/headers";
import { OfflineBanner } from "@/components/OfflineBanner";
import "./globals.css";

// Brand typography: Poppins (Latin display, numbers) + Rubik (Hebrew headings & body).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: { default: "The Quest", template: "%s · The Quest" },
  description: "Life is a game. Are you going to play?",
  applicationName: "The Quest",
};

export const viewport: Viewport = {
  themeColor: "#0B0B12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the request makes every page dynamic, which the per-request CSP nonce
  // (set in proxy.ts and applied by Next to its scripts) requires.
  await headers();

  return (
    <html lang="he" dir="rtl" className={`${poppins.variable} ${rubik.variable} antialiased`}>
      <body className="flex min-h-svh flex-col">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
