'use client';

import { useEffect } from 'react';
import { Trash2, Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { PLATFORMS, parsePlatforms, formatRelativeTime, type Content } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  items: Content[];
  loading: boolean;
}

export function HistorySidebar({ items, loading }: Props) {
  const { toast } = useToast();
  const { activeContent, setActiveContent, historyVersion, bumpHistory } = useAppStore();

  useEffect(() => {
    // re-render trigger
  }, [historyVersion]);

  const handleSelect = (c: Content) => {
    setActiveContent(c);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal hapus');
      if (activeContent?.id === id) {
        setActiveContent(null);
      }
      bumpHistory();
      toast.success('Konten dihapus');
    } catch (e: any) {
      toast.error(e?.message ?? 'Gagal hapus');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/40">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Riwayat ({items.length})
        </div>
        {items.length > 0 && (
          <Badge variant="outline" className="text-xs">Tersimpan lokal</Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground px-4">
            Belum ada riwayat. Generate konten pertamamu di atas.
          </div>
        )}
        {items.map((c) => {
          const platforms = parsePlatforms(c.platforms);
          const isActive = activeContent?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className={`group w-full text-left rounded-lg border p-2.5 transition-all ${
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border/40 bg-background/30 hover:border-border/80 hover:bg-background/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-2 leading-snug">{c.topic}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {c.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                    {c.status === 'failed' && <XCircle className="h-3 w-3 text-destructive" />}
                    {c.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    <span>{formatRelativeTime(c.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  aria-label="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {platforms.map((p) => {
                  const info = PLATFORMS.find((x) => x.id === p);
                  return (
                    <span
                      key={p}
                      className="inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white"
                      style={{ backgroundColor: info?.color }}
                      title={info?.label}
                    >
                      {info?.emoji}
                    </span>
                  );
                })}
                <span className="text-[10px] text-muted-foreground ml-1">
                  · {c.language === 'id' ? 'ID' : 'EN'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
