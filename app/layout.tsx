import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/cookie-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Veyraflow — AI game asset generator", template: "%s · Veyraflow" },
  description: "Generate game-ready 2D sprites, animations, 3D models, sound effects, music and voices with AI. Export for Unity, Unreal and Godot.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
