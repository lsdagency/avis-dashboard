import type { Metadata } from "next";
import "./globals.css";

const APP_NAME = process.env.APP_NAME || "Avis Budget Group";

export const metadata: Metadata = {
  title: `${APP_NAME} · Live Reporting Dashboard`,
  description:
    "Live paid-media reporting across Meta, Reddit and TikTok with optimised budget recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
