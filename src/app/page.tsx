'use client';

import { useEffect, useState } from 'react';
import { Zap, Server, PanelLeftOpen, PanelLeftClose, LogOut } from 'lucide-react';
import { GeneratorForm } from '@/components/generator-form';
import { GenerationProgress } from '@/components/generation-progress';
import { ResultView } from '@/components/result-view';
import { HistorySidebar } from '@/components/history-sidebar';
import { useAppStore } from '@/lib/store';
import type { Content } from '@/lib/types';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { activeContentId, activeContent, setActiveContent, setActiveContentId, sidebarOpen, setSidebarOpen } = useAppStore();
  const [history, setHistory] = useState<Content[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load history on mount + when historyVersion changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch('/api/content/list', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && data.items) {
          setHistory(data.items as Content[]);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useAppStore((s) => s.historyVersion)]);

  // Auto-poll the active content if it's running
  useEffect(() => {
    if (!activeContentId) return;
    if (activeContent && (activeContent.status === 'completed' || activeContent.status === 'failed')) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      // First poll quickly to catch rapid status updates
      await new Promise((r) => setTimeout(r, 1200));
      while (!cancelled) {
        try {
          const res = await fetch(`/api/content/${activeContentId}`, { cache: 'no-store' });
          const data = await res.json();
          if (data.content) {
            setActiveContent(data.content as Content);
            if (data.content.status === 'completed' || data.content.status === 'failed') {
              useAppStore.getState().bumpHistory();
              break;
            }
          }
        } catch {
          // keep trying
        }
        if (cancelled) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    poll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContentId]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handleGenerated = () => {
    useAppStore.getState().bumpHistory();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/40 bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
          <img src="/favicon.svg" alt="AWANT" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-base font-extrabold leading-tight tracking-wide">AWANT</h1>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-cyan-400 leading-tight">KONTEN AI STUDIO</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            OpenAI Provider
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
          <a
            href="https://www.proxmox.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs hover:bg-background/60 transition"
            title="Siap deploy ke Proxmox LXC"
          >
            <Server className="h-3.5 w-3.5" />
            Proxmox Ready
          </a>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`
            ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50 translate-x-0' : 'fixed -translate-x-full lg:translate-x-0 lg:static'}
            top-[57px] lg:top-0 lg:z-0
            w-72 lg:w-72 border-r border-border/40 bg-card/30 backdrop-blur-md transition-transform duration-200
          `}
        >
          <HistorySidebar items={history} loading={historyLoading} />
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
            {/* Hero / Generator */}
            <section className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary font-medium">
                  <Zap className="h-3.5 w-3.5" />
                  One-click Multi-platform Generator
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Bikin Konten <span className="gradient-text">FB + YouTube + TikTok + IG</span><br />Sekali Klik.
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Cukup tulis topik, AI otomatis bikin script, caption, hashtag, thumbnail, dan voice-over —
                  dioptimalkan untuk setiap platform. Hasilnya tinggal download.
                </p>
              </div>

              <GeneratorForm onGenerated={handleGenerated} />
            </section>

            {/* Progress / Result */}
            {activeContent && (
              <section className="space-y-4">
                <GenerationProgress content={activeContent} onDone={() => useAppStore.getState().bumpHistory()} />
                {activeContent.status === 'completed' && <ResultView content={activeContent} />}
              </section>
            )}

            {!activeContent && history.length > 0 && (
              <section className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Pilih salah satu konten dari riwayat di sidebar kiri, atau generate baru di atas.
                </p>
              </section>
            )}

            {history.length === 0 && !activeContent && (
              <section className="rounded-2xl border border-dashed border-border/40 p-12 text-center">
                <div className="text-4xl mb-3">🎬</div>
                <h3 className="text-lg font-semibold">Belum ada konten</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Tulis topik di atas, pilih platform, klik tombol generate. AI akan langsung kerja.
                </p>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background/80 backdrop-blur px-4 py-3 text-center text-xs text-muted-foreground">
        AWANT Konten AI Studio · Powered by OpenAI · Deploy ke Proxmox LXC Ubuntu · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
