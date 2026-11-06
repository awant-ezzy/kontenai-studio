import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KontenAI Studio — Generator Konten FB & YouTube Sekali Klik",
  description:
    "Aplikasi AI terkini untuk membuat konten Facebook, YouTube, TikTok, dan Instagram sekali klik. Script, thumbnail, voiceover, dan video pendek otomatis dibuat AI.",
  keywords: [
    "AI content generator",
    "Facebook content",
    "YouTube content",
    "TikTok content",
    "Instagram content",
    "AI voiceover",
    "AI thumbnail",
    "KontenAI",
    "Proxmox",
  ],
  authors: [{ name: "KontenAI Studio" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "KontenAI Studio",
    description: "Generator konten AI sekali klik untuk Facebook & YouTube",
    siteName: "KontenAI Studio",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
