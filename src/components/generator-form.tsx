'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import { PLATFORMS, TONES, NICHES, LANGUAGES, type Platform } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  onGenerated: () => void;
}

export function GeneratorForm({ onGenerated }: Props) {
  const { toast: uiToast } = useToast();
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['youtube', 'facebook']);
  const [tone, setTone] = useState('casual');
  const [niche, setNiche] = useState('general');
  const [generateVoiceover, setGenerateVoiceover] = useState(true);
  const [generateVideo, setGenerateVideo] = useState(true);
  const [loading, setLoading] = useState(false);

  const togglePlatform = (id: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!topic.trim()) {
      toast.error('Topik wajib diisi');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Pilih minimal 1 platform');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          language,
          platforms: selectedPlatforms,
          tone,
          niche,
          generateVoiceover,
          generateVideo,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal generate konten');
      }
      const data = await res.json();
      useAppStore.getState().setActiveContentId(data.content.id);
      useAppStore.getState().setActiveContent(data.content);
      useAppStore.getState().bumpHistory();
      onGenerated();
      toast.success('Pipeline AI dimulai!', {
        description: `${selectedPlatforms.length} platform · progress realtime di bawah`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Gagal generate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Topic Input */}
      <div className="space-y-2">
        <Label htmlFor="topic" className="text-sm font-medium text-muted-foreground">
          Topik atau Ide Konten
        </Label>
        <Textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Contoh: Cara memulai bisnis kopi dari nol hingga omzet 10 juta per bulan..."
          className="min-h-24 resize-none bg-background/50 border-border/60 focus-visible:border-primary text-base"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Tulis topik bebas. AI akan otomatis buat script, caption, hashtag, thumbnail, voiceover & video pendek.
        </p>
      </div>

      {/* Platforms */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Platform Target</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLATFORMS.map((p) => {
            const active = selectedPlatforms.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                disabled={loading}
                className={`relative rounded-xl border p-3 transition-all text-left ${
                  active
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                    : 'border-border/60 bg-background/30 hover:border-border hover:bg-background/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground">{p.ratio}</div>
                  </div>
                </div>
                {active && (
                  <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Language & Tone & Niche */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Bahasa Output</Label>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLanguage(l.id as 'id' | 'en')}
                disabled={loading}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                  language === l.id
                    ? 'border-primary bg-primary/10 font-semibold'
                    : 'border-border/60 hover:bg-background/60'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Tone</Label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {TONES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Niche</Label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {NICHES.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Asset toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={generateVoiceover ? 'default' : 'outline'}
          className="cursor-pointer select-none px-3 py-1.5"
          onClick={() => !loading && setGenerateVoiceover((v) => !v)}
        >
          🎙️ Voiceover (TTS)
        </Badge>
        <Badge
          variant={generateVideo ? 'default' : 'outline'}
          className="cursor-pointer select-none px-3 py-1.5"
          onClick={() => !loading && setGenerateVideo((v) => !v)}
        >
          🎬 Video Pendek AI
        </Badge>
      </div>

      {/* Generate Button */}
      <Button
        type="button"
        size="lg"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-14 text-base font-bold glow-primary"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Lagi ngerjain kontenmu... sabar ya
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Generate Konten Sekali Klik
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Pipeline: Script → Caption → Hashtag → Thumbnail → Voiceover → Video (≈ 30-90 detik)
      </p>
    </div>
  );
}
