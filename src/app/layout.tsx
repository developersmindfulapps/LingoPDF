import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LingoPDF — German-to-English PDF Word Translation Extension",
  description:
    "Read German PDFs with effortless inline word lookup. A lightweight browser extension for native Chrome and web PDFs with local-first dictionary processing.",
  icons: {
    icon: [
      { url: "/images/lingopdf-emblem.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: [
      { url: "/icon-48.png", sizes: "48x48" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[var(--color-warm-ivory)] text-[var(--color-charcoal)]">
        {children}
      </body>
    </html>
  );
}
