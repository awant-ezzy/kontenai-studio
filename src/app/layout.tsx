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
  title: "AWANT Konten AI Studio — Generator Konten Multi-Platform",
  description:
    "Studio AI AWANT untuk membuat script, caption, hashtag, thumbnail, dan voice-over untuk Facebook, YouTube, TikTok, dan Instagram.",
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
  authors: [{ name: "AWANT Konten AI Studio" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "AWANT Konten AI Studio",
    description: "Studio kreator konten AI multi-platform dari AWANT.",
    siteName: "AWANT Konten AI Studio",
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
