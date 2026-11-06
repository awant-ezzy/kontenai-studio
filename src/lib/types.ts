// Shared types for the KontenAI Studio app

export type Platform = 'youtube' | 'facebook' | 'tiktok' | 'instagram';

export type AssetType =
  | 'title'
  | 'script'
  | 'caption'
  | 'hashtags'
  | 'description'
  | 'thumbnail'
  | 'voiceover'
  | 'video';

export interface Asset {
  id: string;
  contentId: string;
  platform: string;
  type: AssetType;
  value: string;
  meta: string | null;
  createdAt: string;
}

export interface Content {
  id: string;
  topic: string;
  language: string;
  platforms: string; // JSON
  tone: string | null;
  niche: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  step: string | null;
  error: string | null;
  assets: Asset[];
  createdAt: string;
  updatedAt: string;
}

export const PLATFORMS: { id: Platform; label: string; color: string; ratio: string; emoji: string }[] = [
  { id: 'youtube', label: 'YouTube', color: '#FF0000', ratio: '16:9', emoji: '▶' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', ratio: '1:1', emoji: 'f' },
  { id: 'tiktok', label: 'TikTok', color: '#25F4EE', ratio: '9:16', emoji: '♪' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', ratio: '4:5', emoji: '◉' },
];

export const TONES = [
  { id: 'casual', label: 'Santai', desc: 'Gaya ngobrol, friendly' },
  { id: 'professional', label: 'Profesional', desc: 'Formal, to the point' },
  { id: 'educational', label: 'Edukatif', desc: 'Penjelasan, informatif' },
  { id: 'humorous', label: 'Lucu', desc: 'Hiburan, lelucon' },
  { id: 'inspirational', label: 'Inspiratif', desc: 'Motivasi, semangat' },
  { id: 'controversial', label: 'Provokatif', desc: 'Debat, viral hook' },
];

export const NICHES = [
  { id: 'general', label: 'Umum' },
  { id: 'tech', label: 'Teknologi' },
  { id: 'food', label: 'Makanan' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'finance', label: 'Keuangan' },
  { id: 'education', label: 'Pendidikan' },
  { id: 'entertainment', label: 'Hiburan' },
  { id: 'health', label: 'Kesehatan' },
  { id: 'travel', label: 'Travel' },
  { id: 'business', label: 'Bisnis' },
];

export const LANGUAGES = [
  { id: 'id', label: 'Bahasa Indonesia' },
  { id: 'en', label: 'English' },
];

export function parsePlatforms(json: string): Platform[] {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr as Platform[];
  } catch {
    // ignore
  }
  return [];
}

export function groupAssetsByPlatform(assets: Asset[]): Record<string, Asset[]> {
  const groups: Record<string, Asset[]> = {};
  for (const a of assets) {
    if (!groups[a.platform]) groups[a.platform] = [];
    groups[a.platform].push(a);
  }
  return groups;
}

export function getAsset(assets: Asset[], platform: string, type: AssetType): Asset | undefined {
  return assets.find((a) => a.platform === platform && a.type === type);
}

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
