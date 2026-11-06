'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Sparkles, FileText, Image as ImageIcon, Mic, Video, Hash } from 'lucide-react';
import type { Content } from '@/lib/types';

interface Props {
  content: Content | null;
  onDone?: () => void;
}

const STEP_LABELS = [
  { pct: 0, label: 'Menyiapkan', icon: Sparkles },
  { pct: 10, label: 'Membuat script & caption', icon: FileText },
  { pct: 40, label: 'Menyimpan text assets', icon: FileText },
  { pct: 55, label: 'Membuat thumbnail AI', icon: ImageIcon },
  { pct: 75, label: 'Membuat voiceover AI', icon: Mic },
  { pct: 85, label: 'Membuat video pendek AI', icon: Video },
  { pct: 100, label: 'Selesai', icon: CheckCircle2 },
];

export function GenerationProgress({ content, onDone }: Props) {
  const [current, setCurrent] = useState<Content | null>(content);
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    if (!content) return;

    // Initial state
    setCurrent(content);

    if (content.status === 'completed' || content.status === 'failed') {
      onDone?.();
      return;
    }

    // Start polling
    let cancelled = false;
    const poll = async () => {
      let lastUpdatedAt = new Date(content.updatedAt).getTime();
      while (!cancelled && !stopRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) break;
        try {
          const since = lastUpdatedAt;
          const res = await fetch(`/api/content/${content.id}/poll?since=${since}`, { cache: 'no-store' });
          if (!res.ok) break;
          const data = await res.json();
          if (!data.content) break;
          setCurrent(data.content);
          lastUpdatedAt = new Date(data.content.updatedAt).getTime();
          if (data.content.status === 'completed' || data.content.status === 'failed') {
            onDone?.();
            break;
          }
        } catch {
          // keep trying
        }
      }
    };
    poll();

    return () => {
      cancelled = true;
      stopRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.id]);

  if (!current) return null;

  const progress = current.progress ?? 0;
  const stepLabel = current.step ?? 'Memulai...';
  const failed = current.status === 'failed';

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur p-6 space-y-4">
      <div className="flex items-center gap-3">
        {failed ? (
          <XCircle className="h-6 w-6 text-destructive" />
        ) : progress >= 100 ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        ) : (
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        )}
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {failed ? 'Generasi gagal' : progress >= 100 ? 'Konten siap!' : 'Lagi ngerjain kontenmu...'}
          </div>
          <div className="text-xs text-muted-foreground">{stepLabel}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums">{progress}%</div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
            failed ? 'bg-destructive' : 'bg-primary'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {STEP_LABELS.map((s) => {
          const done = progress >= s.pct && progress > 0;
          const current = progress >= (STEP_LABELS.find((x, i) => i > STEP_LABELS.indexOf(s))?.pct ?? 999)
            ? false
            : progress >= s.pct && progress < (STEP_LABELS[STEP_LABELS.indexOf(s) + 1]?.pct ?? 999);
          return (
            <div
              key={s.pct}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                current ? 'bg-primary/10 text-primary' : done ? 'text-muted-foreground' : 'text-muted-foreground/60'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : current ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <s.icon className="h-3.5 w-3.5" />
              )}
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>

      {failed && current.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <div className="font-semibold mb-1">Error:</div>
          <pre className="whitespace-pre-wrap break-words font-mono">{current.error}</pre>
        </div>
      )}
    </div>
  );
}
