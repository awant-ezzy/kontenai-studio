'use client';

import { create } from 'zustand';
import type { Content } from '@/lib/types';

interface AppState {
  // Current generation in progress (its content id)
  activeContentId: string | null;
  setActiveContentId: (id: string | null) => void;

  // Currently viewing content (full result)
  activeContent: Content | null;
  setActiveContent: (c: Content | null) => void;

  // History list refresh trigger
  historyVersion: number;
  bumpHistory: () => void;

  // Sidebar open on mobile
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeContentId: null,
  setActiveContentId: (id) => set({ activeContentId: id }),
  activeContent: null,
  setActiveContent: (c) => set({ activeContent: c }),
  historyVersion: 0,
  bumpHistory: () => set((s) => ({ historyVersion: s.historyVersion + 1 })),
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}));
