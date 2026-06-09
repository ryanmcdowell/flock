import { create } from 'zustand'
import { ALL_CATS } from '../categories'
import type { CheckIn, Prefs, SyncProgress, Filters, AppView, PanelView } from '../types'

interface AppState {
  // Data
  checkins: CheckIn[]
  prefs: Prefs
  // UI
  appView: AppView
  panelView: PanelView
  selectedCheckinId: string | null
  hoveredCheckinId: string | null
  searchQuery: string
  filters: Filters
  syncProgress: SyncProgress | null
  syncError: string | null
  // Actions
  setCheckins: (checkins: CheckIn[]) => void
  setPrefs: (prefs: Prefs) => void
  setAppView: (view: AppView) => void
  setPanelView: (view: PanelView) => void
  setSelectedCheckinId: (id: string | null) => void
  setHoveredCheckinId: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setFilters: (f: Filters) => void
  clearFilters: () => void
  setSyncProgress: (p: SyncProgress | null) => void
  setSyncError: (e: string | null) => void
}

const DEFAULT_FILTERS: Filters = {
  datePreset: 'all',
  city: null,
  cats: new Set(ALL_CATS),
}
const DEFAULT_PREFS: Prefs = { show_categories: true, show_notes: true, map_lat: 0, map_lng: 0, map_zoom: 3 }

function freshDefaults() {
  return {
    datePreset: 'all' as const,
    city: null,
    cats: new Set(ALL_CATS),
  }
}

export const useAppStore = create<AppState>()((set) => ({
  checkins: [],
  prefs: DEFAULT_PREFS,
  appView: 'connect',
  panelView: 'timeline',
  selectedCheckinId: null,
  hoveredCheckinId: null,
  searchQuery: '',
  filters: DEFAULT_FILTERS,
  syncProgress: null,
  syncError: null,
  setCheckins: (checkins) => set({ checkins }),
  setPrefs: (prefs) => set({ prefs }),
  setAppView: (appView) => set({ appView }),
  setPanelView: (panelView) => set({ panelView }),
  setSelectedCheckinId: (selectedCheckinId) => set({ selectedCheckinId }),
  setHoveredCheckinId: (hoveredCheckinId) => set({ hoveredCheckinId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: freshDefaults(), searchQuery: '' }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),
  setSyncError: (syncError) => set({ syncError }),
}))

// Expose getInitialState for test resets
;(useAppStore as any).getInitialState = () => ({
  checkins: [], prefs: DEFAULT_PREFS, appView: 'connect' as AppView,
  panelView: 'timeline' as PanelView, selectedCheckinId: null, hoveredCheckinId: null,
  searchQuery: '', filters: { ...freshDefaults() }, syncProgress: null,
  syncError: null,
})
