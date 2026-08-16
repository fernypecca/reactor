import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reactor — Simulate your audience before you post",
  description:
    "Pre-launch your post against a simulated audience. Paste your launch copy, watch clones of your followers react with scores and objections, and get a rewrite that lands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex-col">{children}</body>
    </html>
  );
}