import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Untitled — ZamnCraft",
  description:
    "A little space for your next big idea. The ZamnCraft visual web editor.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
