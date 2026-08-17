import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reactor — Read the room before you post",
  description:
    "Watch a simulated audience react to your launch copy in real time. Clones of your followers score it, object to it, and show you which version wins — before anyone real sees it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${display.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
