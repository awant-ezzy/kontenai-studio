'use client';

import { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Play,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Hash,
  Type,
  AlignLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Content, Asset, Platform } from '@/lib/types';
import { PLATFORMS, parsePlatforms, getAsset, formatRelativeTime } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  content: Content;
}

const ASSET_META: Record<string, { label: string; icon: any; color: string }> = {
  title: { label: 'Judul', icon: Type, color: 'text-yellow-500' },
  script: { label: 'Script Video', icon: AlignLeft, color: 'text-blue-500' },
  caption: { label: 'Caption', icon: FileText, color: 'text-emerald-500' },
  hashtags: { label: 'Hashtag', icon: Hash, color: 'text-purple-500' },
  description: { label: 'Deskripsi', icon: FileText, color: 'text-cyan-500' },
  thumbnail: { label: 'Thumbnail', icon: ImageIcon, color: 'text-pink-500' },
  voiceover: { label: 'Voiceover', icon: Mic, color: 'text-orange-500' },
  video: { label: 'Video', icon: Video, color: 'text-red-500' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Tersalin!');
    } catch {
      toast.error('Gagal menyalin');
    }
  };
  return (
    <Button size="sm" variant="ghost" onClick={handle} className="h-7 gap-1.5 text-xs">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Tersalin' : 'Salin'}
    </Button>
  );
}

function TextAssetCard({ asset, title }: { asset: Asset; title: string }) {
  const [expanded, setExpanded] = useState(false);
  const value = asset.value || '';
  const isLong = value.length > 400;
  const display = expanded || !isLong ? value : value.slice(0, 400) + '...';

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {(() => {
            const meta = ASSET_META[asset.type];
            return meta ? <meta.icon className={`h-4 w-4 ${meta.color}`} /> : null;
          })()}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <CopyButton text={value} />
      </div>
      <div className="whitespace-pre-wrap text-sm text-foreground/90 font-mono leading-relaxed">
        {display || <span className="text-muted-foreground italic">Tidak ada data</span>}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? 'Sembunyikan' : 'Tampilkan selengkapnya'}
        </button>
      )}
    </div>
  );
}

function ThumbnailCard({ asset, platform }: { asset: Asset; platform: Platform }) {
  const [loading, setLoading] = useState(true);
  const platformInfo = PLATFORMS.find((p) => p.id === platform);
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-semibold">Thumbnail {platformInfo?.label}</span>
          <Badge variant="outline" className="text-xs">{platformInfo?.ratio}</Badge>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
          <a href={asset.value} download>
            <Download className="h-3 w-3" /> Download
          </a>
        </Button>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.value}
          alt={`Thumbnail ${platformInfo?.label}`}
          className="h-full w-full object-cover"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  );
}

function AudioCard({ asset, platform }: { asset: Asset; platform: Platform }) {
  const platformInfo = PLATFORMS.find((p) => p.id === platform);
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Voiceover {platformInfo?.label}</span>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
          <a href={asset.value} download>
            <Download className="h-3 w-3" /> Download WAV
          </a>
        </Button>
      </div>
      <audio controls src={asset.value} className="w-full" />
    </div>
  );
}

function VideoCard({ asset }: { asset: Asset }) {
  if (!asset.value) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold">Video Pendek AI</span>
        </div>
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          Video tidak tersedia (timeout/gagal dari provider). Coba generate ulang.
        </div>
      </div>
    );
  }
  // External URL - render as link/video if possible
  const isExternal = /^https?:\/\//.test(asset.value);
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold">Video Pendek AI</span>
          <Badge variant="outline" className="text-xs">5 detik · 720p</Badge>
        </div>
        {isExternal && (
          <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
            <a href={asset.value} target="_blank" rel="noreferrer">
              <Download className="h-3 w-3" /> Buka Video
            </a>
          </Button>
        )}
      </div>
      {isExternal ? (
        <video controls src={asset.value} className="w-full rounded-lg" />
      ) : (
        <video controls src={asset.value} className="w-full rounded-lg" />
      )}
    </div>
  );
}

function PlatformResult({ content, platform }: { content: Content; platform: Platform }) {
  const platformInfo = PLATFORMS.find((p) => p.id === platform);
  const titles = getAsset(content.assets, platform, 'title');
  const script = getAsset(content.assets, platform, 'script');
  const caption = getAsset(content.assets, platform, 'caption');
  const hashtags = getAsset(content.assets, platform, 'hashtags');
  const description = getAsset(content.assets, platform, 'description');
  const thumbnail = getAsset(content.assets, platform, 'thumbnail');
  const voiceover = getAsset(content.assets, platform, 'voiceover');
  const video = content.assets.find((a) => a.type === 'video'); // shared

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-border/40">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: platformInfo?.color }}
        >
          {platformInfo?.emoji}
        </div>
        <div>
          <div className="text-base font-semibold">{platformInfo?.label}</div>
          <div className="text-xs text-muted-foreground">Rasio {platformInfo?.ratio} · dioptimalkan untuk {platformInfo?.label}</div>
        </div>
      </div>

      {thumbnail && <ThumbnailCard asset={thumbnail} platform={platform} />}

      {titles && <TextAssetCard asset={titles} title="3 Pilihan Judul" />}
      {script && <TextAssetCard asset={script} title="Script Video" />}
      {caption && <TextAssetCard asset={caption} title="Caption" />}
      {hashtags && <TextAssetCard asset={hashtags} title="Hashtag" />}
      {description && <TextAssetCard asset={description} title="Deskripsi" />}

      {voiceover && <AudioCard asset={voiceover} platform={platform} />}
      {video && platform === (parsePlatforms(content.platforms)[0] ?? 'youtube') && <VideoCard asset={video} />}
    </div>
  );
}

export function ResultView({ content }: Props) {
  const platforms = parsePlatforms(content.platforms);
  if (platforms.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Topik</div>
          <div className="text-lg font-semibold">{content.topic}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">{content.language === 'id' ? 'Indonesia' : 'English'}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{content.tone}</Badge>
            {content.niche && content.niche !== 'general' && (
              <Badge variant="outline" className="text-xs capitalize">{content.niche}</Badge>
            )}
            <span>·</span>
            <span>{formatRelativeTime(content.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Tabs per platform */}
      <Tabs key={content.id} defaultValue={platforms[0]} className="w-full">
        <TabsList className={`w-full justify-start overflow-x-auto h-auto py-1.5 ${platforms.length > 3 ? 'max-w-full' : ''}`}>
          {platforms.map((p) => {
            const info = PLATFORMS.find((x) => x.id === p);
            return (
              <TabsTrigger key={p} value={p} className="gap-2 px-4 py-1.5 text-sm">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: info?.color }}
                >
                  {info?.emoji}
                </span>
                {info?.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {platforms.map((p) => (
          <TabsContent key={p} value={p} className="mt-4">
            <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px] scrollbar-thin pr-3">
              <PlatformResult content={content} platform={p} />
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
