import { useEffect, useRef, useState } from 'react'
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
  { elementType: 'geometry', stylers: [{ color: '#ede5d2' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ede5d2' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#cdc4ad' }] },
  { featureType: 'administrative.country', elementType: 'labels.text', stylers: [{ visibility: 'on' }, { color: '#666' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text', stylers: [{ visibility: 'on' }, { color: '#888' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e3d8be' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d4c39f' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbd4c2' }] },
  { featureType: 'landscape.man_made', stylers: [{ color: '#e8e0c8' }] },
]

function pinIcon(color: string, selected: boolean): google.maps.Icon {
  const scale = selected ? 1.25 : 1
  const r = 9 * scale
  const inner = 3.2 * scale
  const size = Math.ceil(r * 2 + 4)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-size/2} ${-size/2} ${size} ${size}">
    <circle r="${r}" fill="white" stroke="${color}" stroke-width="2.2"/>
    <circle r="${inner}" fill="${color}"/>
  </svg>`
  return {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const clusterer = useRef<MarkerClusterer | null>(null)
  const markersById = useRef<Map<string, google.maps.Marker>>(new Map())
  const [mapsReady, setMapsReady] = useState(false)
  const filteredCheckins = useFilteredCheckins()
  const prefs = useAppStore(s => s.prefs)
  const selectedCheckinId = useAppStore(s => s.selectedCheckinId)
  const setSelectedCheckinId = useAppStore(s => s.setSelectedCheckinId)

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
      clusterer.current = new MarkerClusterer({ map: mapInstance.current })
      mapInstance.current.addListener('idle', () => {
        const center = mapInstance.current!.getCenter()
        const zoom = mapInstance.current!.getZoom()
        if (!center || zoom === undefined) return
        const updated: Prefs = {
          ...useAppStore.getState().prefs,
          map_lat: center.lat(),
          map_lng: center.lng(),
          map_zoom: zoom,
        }
        useAppStore.getState().setPrefs(updated)
        invoke('save_prefs', { prefs: updated }).catch(console.error)
      })
      setMapsReady(true)
    })
  }, [])

  // Rebuild markers when filtered checkins change
  useEffect(() => {
    if (!mapsReady || !mapInstance.current || !clusterer.current) return
    clusterer.current.clearMarkers()
    markersById.current.clear()

    const newMarkers = filteredCheckins
      .filter(c => c.lat !== null && c.lng !== null)
      .map(c => {
        const cat = mapCategory(c.venue_category)
        const color = CAT_STYLE[cat].dot
        const marker = new google.maps.Marker({
          position: { lat: c.lat!, lng: c.lng! },
          icon: pinIcon(color, c.id === selectedCheckinId),
        })
        marker.addListener('click', () => setSelectedCheckinId(c.id))
        markersById.current.set(c.id, marker)
        return marker
      })

    clusterer.current.addMarkers(newMarkers)
  }, [filteredCheckins, mapsReady])

  // Update marker icon when selection changes
  useEffect(() => {
    if (!mapsReady) return
    for (const [id, marker] of markersById.current) {
      const c = filteredCheckins.find(x => x.id === id)
      if (!c) continue
      const cat = mapCategory(c.venue_category)
      const color = CAT_STYLE[cat].dot
      marker.setIcon(pinIcon(color, id === selectedCheckinId))
    }
    if (selectedCheckinId && mapInstance.current) {
      const c = filteredCheckins.find(x => x.id === selectedCheckinId)
      if (c?.lat != null && c?.lng != null) {
        mapInstance.current.panTo({ lat: c.lat, lng: c.lng })
      }
    }
  }, [selectedCheckinId, mapsReady])

  const selected = selectedCheckinId ? filteredCheckins.find(c => c.id === selectedCheckinId) ?? null : null

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
