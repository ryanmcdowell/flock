import { create } from 'zustand'
import type { CheckIn, Prefs, SyncProgress, Filters, AppView, PanelView } from '../types'

interface AppState {
  // Data
  checkins: CheckIn[]
  prefs: Prefs
  // UI
  appView: AppView
  panelView: PanelView
  selectedCheckinId: string | null
  searchQuery: string
  filters: Filters
  syncProgress: SyncProgress | null
  // Actions
  setCheckins: (checkins: CheckIn[]) => void
  setPrefs: (prefs: Prefs) => void
  setAppView: (view: AppView) => void
  setPanelView: (view: PanelView) => void
  setSelectedCheckinId: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setFilters: (f: Filters) => void
  clearFilters: () => void
  setSyncProgress: (p: SyncProgress | null) => void
}

const DEFAULT_FILTERS: Filters = { dateRange: { start: null, end: null }, city: null }
const DEFAULT_PREFS: Prefs = { show_categories: true, show_notes: true, map_lat: 0, map_lng: 0, map_zoom: 3 }

export const useAppStore = create<AppState>()((set) => ({
  checkins: [],
  prefs: DEFAULT_PREFS,
  appView: 'connect',
  panelView: 'timeline',
  selectedCheckinId: null,
  searchQuery: '',
  filters: DEFAULT_FILTERS,
  syncProgress: null,
  setCheckins: (checkins) => set({ checkins }),
  setPrefs: (prefs) => set({ prefs }),
  setAppView: (appView) => set({ appView }),
  setPanelView: (panelView) => set({ panelView }),
  setSelectedCheckinId: (selectedCheckinId) => set({ selectedCheckinId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: DEFAULT_FILTERS }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),
}))

// Expose getInitialState for test resets
;(useAppStore as any).getInitialState = () => ({
  checkins: [], prefs: DEFAULT_PREFS, appView: 'connect' as AppView,
  panelView: 'timeline' as PanelView, selectedCheckinId: null,
  searchQuery: '', filters: DEFAULT_FILTERS, syncProgress: null,
})
