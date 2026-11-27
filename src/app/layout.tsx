import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const editorFont = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-editor",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  description:
    "A little space for your next big idea. The ZamnCraft visual web editor.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={editorFont.variable}>{children}</body>
    </html>
  );
}
