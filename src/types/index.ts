export interface CheckIn {
  id: string
  venue_id: string | null
  venue_name: string
  venue_address: string | null
  venue_city: string | null
  venue_country: string | null
  venue_category: string | null
  lat: number | null
  lng: number | null
  checked_in_at: number  // Unix timestamp
  note: string | null
  swarm_url: string | null
}

export interface Prefs {
  show_categories: boolean
  show_notes: boolean
  map_lat: number
  map_lng: number
  map_zoom: number
}

export interface SyncState {
  last_sync_at: number | null
  total_fetched: number
  bulk_load_complete: boolean
}

export interface SyncProgress {
  loaded: number
  total: number
}

export interface Filters {
  dateRange: { start: number | null; end: number | null }
  city: string | null
}

export type AppView = 'connect' | 'loading' | 'main'
export type PanelView = 'timeline' | 'stats'
