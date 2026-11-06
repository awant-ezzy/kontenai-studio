import path from 'path';
import { promises as fsp } from 'fs';

// Assets are saved under public/uploads so they are directly accessible via /uploads/...
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

export async function ensureUploadsDir(contentId: string): Promise<string> {
  const dir = path.join(UPLOADS_DIR, contentId);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

export function getPublicUrl(contentId: string, filename: string): string {
  return `/uploads/${contentId}/${filename}`;
}

export async function deleteContentAssets(contentId: string): Promise<void> {
  const dir = path.join(UPLOADS_DIR, contentId);
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// Map platform → image size for thumbnail (Z.ai supported sizes)
// Supported sizes: 1024x1024 (1:1), 768x1344 (9:16), 864x1152 (3:4),
// 1344x768 (16:9), 1152x864 (4:3), 1440x720 (2:1), 720x1440 (1:2)
export const PLATFORM_IMAGE_SIZE: Record<string, '1024x1024' | '768x1344' | '1344x768' | '720x1440' | '1440x720' | '864x1152' | '1152x864'> = {
  youtube: '1344x768', // 16:9
  facebook: '1024x1024', // 1:1
  tiktok: '768x1344', // 9:16
  instagram: '864x1152', // 4:5
};

export const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

export const PLATFORM_RATIO: Record<string, string> = {
  youtube: '16:9',
  facebook: '1:1',
  tiktok: '9:16',
  instagram: '4:5',
};

export const PLATFORM_COLOR: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#25F4EE',
  instagram: '#E1306C',
};
