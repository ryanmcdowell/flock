import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import { CAT_STYLE, mapCategory } from '../categories'
import DetailCard from './DetailCard'
import type { Prefs } from '../types'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

const PAPER_STYLES: google.maps.MapTypeStyle[] = [
  // Base land
  { elementType: 'geometry', stylers: [{ color: '#ede5d2' }] },

  // Hide everything by default, then opt features back in with subtle styling
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ede5d2' }, { weight: 2.5 }] },

  // Country labels — the most prominent tier
  { featureType: 'administrative.country', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#2a2218' }] },

  // State / province labels — muted, so they recede when zoomed out
  { featureType: 'administrative.province', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: '#a89878' }] },

  // City labels — primary at street zoom
  { featureType: 'administrative.locality', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#3d3225' }] },

  // Neighborhoods — too noisy at default zooms, hide entirely
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },

  // Admin boundary lines
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c5b89c' }, { weight: 0.8 }] },

  // POI off
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },

  // Roads: tonal hierarchy from highway down to local
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e3d8be' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d4c39f' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  // Major road labels for navigation context at city zoom
  { featureType: 'road.arterial', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#8a7a5e' }] },
  { featureType: 'road.highway', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b5a42' }] },
  { featureType: 'road.highway', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Transit off
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Water
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbd4c2' }] },
  { featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8a7a5e' }] },

  // Land textures
  { featureType: 'landscape.man_made', stylers: [{ color: '#e8e0c8' }] },
  { featureType: 'landscape.natural.landcover', stylers: [{ color: '#e8dec8' }] },
]

const PAPER_CLUSTER_RENDERER = {
  render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
    const r = 16 + Math.min(count, 50) * 0.25
    const size = Math.ceil((r + 6) * 2)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-size/2} ${-size/2} ${size} ${size}"><circle r="${r + 4}" fill="#FF9933" opacity="0.18"/><circle r="${r}" fill="white" stroke="#FF9933" stroke-width="2.2"/></svg>`
    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;base64,${btoa(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      label: {
        text: String(count),
        color: '#3d3225',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: '600',
      },
      zIndex: 1000 + count,
    })
  },
}

// Build pin SVGs lazily and cache by (color, selected). Only ~12 unique combos.
const ICON_CACHE = new Map<string, google.maps.Icon>()
function getPinIcon(color: string, selected: boolean): google.maps.Icon {
  const key = `${color}|${selected ? 1 : 0}`
  let icon = ICON_CACHE.get(key)
  if (icon) return icon
  const scale = selected ? 1.25 : 1
  const r = 9 * scale
  const inner = 3.2 * scale
  const size = Math.ceil(r * 2 + 4)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-size/2} ${-size/2} ${size} ${size}"><circle r="${r}" fill="white" stroke="${color}" stroke-width="2.2"/><circle r="${inner}" fill="${color}"/></svg>`
  icon = {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
  ICON_CACHE.set(key, icon)
  return icon
}

interface MarkerEntry {
  marker: google.maps.Marker
  color: string
  lat: number
  lng: number
}

export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const clusterer = useRef<MarkerClusterer | null>(null)
  const markersById = useRef<Map<string, MarkerEntry>>(new Map())
  const prevSelectedId = useRef<string | null>(null)
  const savePrefsTimer = useRef<number | null>(null)
  const [mapsReady, setMapsReady] = useState(false)

  const checkins = useAppStore(s => s.checkins)
  const prefs = useAppStore(s => s.prefs)
  const filters = useAppStore(s => s.filters)
  const selectedCheckinId = useAppStore(s => s.selectedCheckinId)
  const setSelectedCheckinId = useAppStore(s => s.setSelectedCheckinId)
  const filteredCheckins = useFilteredCheckins()
  // Defer the heavy clusterer update so a filter click can paint the sidebar
  // selection state and the timeline before we touch the map markers.
  const deferredFiltered = useDeferredValue(filteredCheckins)

  const lastFitKey = useRef<string | null>(null)
  const filterKey = `${filters.city ?? ''}|${filters.datePreset}|${[...filters.cats].sort().join(',')}`

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    if (!MAPS_KEY) {
      console.error('Google Maps API key not configured — set VITE_GOOGLE_MAPS_API_KEY')
      return
    }
    setOptions({ key: MAPS_KEY, v: 'weekly' })
    importLibrary('maps').then(({ Map }) => {
      mapInstance.current = new Map(mapRef.current!, {
        center: { lat: prefs.map_lat || 20, lng: prefs.map_lng || 0 },
        zoom: prefs.map_zoom || 2,
        styles: PAPER_STYLES,
        backgroundColor: '#dbd4c2',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      })
      clusterer.current = new MarkerClusterer({
        map: mapInstance.current,
        renderer: PAPER_CLUSTER_RENDERER,
        onClusterClick: (_event, cluster, map) => {
          // Drop any selected check-in when the user dives into a cluster — the
          // previous selection probably isn't where they're looking anymore.
          useAppStore.getState().setSelectedCheckinId(null)
          if (cluster.bounds) map.fitBounds(cluster.bounds)
        },
      })

      mapInstance.current.addListener('idle', () => {
        const center = mapInstance.current!.getCenter()
        const zoom = mapInstance.current!.getZoom()
        if (!center || zoom === undefined) return
        if (savePrefsTimer.current != null) clearTimeout(savePrefsTimer.current)
        savePrefsTimer.current = window.setTimeout(() => {
          const updated: Prefs = {
            ...useAppStore.getState().prefs,
            map_lat: center.lat(),
            map_lng: center.lng(),
            map_zoom: zoom,
          }
          useAppStore.getState().setPrefs(updated)
          invoke('save_prefs', { prefs: updated }).catch(console.error)
        }, 500)
      })
      setMapsReady(true)
    })
  }, [])

  // Build marker pool from raw checkins (only when the dataset changes, NOT on filter clicks).
  useEffect(() => {
    if (!mapsReady) return
    // Dispose markers we no longer need
    const wantedIds = new Set(checkins.map(c => c.id))
    for (const [id, entry] of markersById.current) {
      if (!wantedIds.has(id)) {
        entry.marker.setMap(null)
        google.maps.event.clearInstanceListeners(entry.marker)
        markersById.current.delete(id)
      }
    }
    // Create markers for new check-ins
    for (const c of checkins) {
      if (c.lat == null || c.lng == null) continue
      if (markersById.current.has(c.id)) continue
      const color = CAT_STYLE[mapCategory(c.venue_category)].dot
      const marker = new google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        icon: getPinIcon(color, false),
      })
      marker.addListener('click', () => setSelectedCheckinId(c.id))
      markersById.current.set(c.id, { marker, color, lat: c.lat, lng: c.lng })
    }
  }, [checkins, mapsReady])

  // Swap the clusterer's visible set when filters change. No marker reconstruction.
  // Wrap in rAF so the cluster recompute waits for the browser to paint the click,
  // and bail if a newer update lands before this one runs.
  useEffect(() => {
    if (!mapsReady || !clusterer.current) return
    const handle = requestAnimationFrame(() => {
      if (!clusterer.current) return
      clusterer.current.clearMarkers()
      const visible: google.maps.Marker[] = []
      for (const c of deferredFiltered) {
        const entry = markersById.current.get(c.id)
        if (entry) visible.push(entry.marker)
      }
      clusterer.current.addMarkers(visible)
    })
    return () => cancelAnimationFrame(handle)
  }, [deferredFiltered, mapsReady])

  // Selection — touch only the previously-selected and newly-selected markers (O(1)).
  useEffect(() => {
    if (!mapsReady) return
    const prev = prevSelectedId.current
    if (prev && prev !== selectedCheckinId) {
      const entry = markersById.current.get(prev)
      if (entry) entry.marker.setIcon(getPinIcon(entry.color, false))
    }
    if (selectedCheckinId) {
      const entry = markersById.current.get(selectedCheckinId)
      const map = mapInstance.current
      if (entry && map) {
        entry.marker.setIcon(getPinIcon(entry.color, true))
        map.panTo({ lat: entry.lat, lng: entry.lng })
        // Zoom in to neighborhood level if currently zoomed out further.
        const NEIGHBORHOOD_ZOOM = 15
        if ((map.getZoom() ?? 0) < NEIGHBORHOOD_ZOOM) {
          map.setZoom(NEIGHBORHOOD_ZOOM)
        }
      }
    }
    prevSelectedId.current = selectedCheckinId
  }, [selectedCheckinId, mapsReady])

  // Refit map to filtered pins on first data arrival and whenever filters change.
  // Use the live filteredCheckins here, NOT deferredFiltered, so the data we fit
  // to matches the filterKey we're gating on — otherwise a click on Brooklyn
  // would briefly fit to the previous city's lagging data and then refuse to
  // re-fit when the deferred value caught up.
  useEffect(() => {
    if (!mapsReady || !mapInstance.current) return
    if (filteredCheckins.length === 0) return
    if (lastFitKey.current === filterKey) return
    lastFitKey.current = filterKey

    const withCoords = filteredCheckins.filter(c => c.lat != null && c.lng != null)
    if (withCoords.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    for (const c of withCoords) bounds.extend({ lat: c.lat!, lng: c.lng! })
    if (withCoords.length === 1) {
      mapInstance.current.panTo(bounds.getCenter())
      mapInstance.current.setZoom(14)
    } else {
      mapInstance.current.fitBounds(bounds, 64)
    }
  }, [filterKey, mapsReady, filteredCheckins])

  const selected = selectedCheckinId
    ? filteredCheckins.find(c => c.id === selectedCheckinId) ?? null
    : null

  if (!MAPS_KEY) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', color: 'var(--ink-3)', borderRadius: 'var(--radius)',
        background: 'var(--map-water)',
      }}>
        Google Maps API key not configured — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--map-water)' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {selected && (
        <div style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}>
          <DetailCard checkin={selected} onClose={() => setSelectedCheckinId(null)} />
        </div>
      )}
    </div>
  )
}
