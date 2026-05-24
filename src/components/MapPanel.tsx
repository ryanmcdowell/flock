import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import DetailCard from './DetailCard'
import type { CheckIn } from '../types'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a2535' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1923' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ab4c8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d4a6e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#162a3a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3a2a' }] },
]

export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const clusterer = useRef<MarkerClusterer | null>(null)
  const markers = useRef<Map<string, google.maps.Marker>>(new Map())
  const [selectedCheckin, setSelectedCheckin] = useState<CheckIn | null>(null)
  const [cardPos, setCardPos] = useState<{ x: number; y: number } | null>(null)
  const filteredCheckins = useFilteredCheckins()
  const { prefs, selectedCheckinId, setSelectedCheckinId } = useAppStore()

  // Detect OS dark mode
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

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
        styles: prefersDark ? DARK_STYLES : [],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      clusterer.current = new MarkerClusterer({ map: mapInstance.current })
    })
  }, [])

  // Sync markers when filtered checkins change
  useEffect(() => {
    if (!mapInstance.current || !clusterer.current) return
    // Remove old markers
    clusterer.current.clearMarkers()
    markers.current.clear()

    const newMarkers = filteredCheckins
      .filter(c => c.lat !== null && c.lng !== null)
      .map(c => {
        const marker = new google.maps.Marker({
          position: { lat: c.lat!, lng: c.lng! },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#F4845F',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        })
        marker.addListener('click', (e: google.maps.MapMouseEvent) => {
          setSelectedCheckin(c)
          setSelectedCheckinId(c.id)
          if (e.domEvent) {
            const rect = mapRef.current!.getBoundingClientRect()
            setCardPos({ x: (e.domEvent as MouseEvent).clientX - rect.left, y: (e.domEvent as MouseEvent).clientY - rect.top })
          }
        })
        markers.current.set(c.id, marker)
        return marker
      })

    clusterer.current.addMarkers(newMarkers)
  }, [filteredCheckins])

  // Pan to selected checkin when changed from timeline
  useEffect(() => {
    if (!selectedCheckinId || !mapInstance.current) return
    const checkin = filteredCheckins.find(c => c.id === selectedCheckinId)
    if (checkin?.lat && checkin?.lng) {
      mapInstance.current.panTo({ lat: checkin.lat, lng: checkin.lng })
      setSelectedCheckin(checkin)
    }
  }, [selectedCheckinId])

  const errorMsg = !MAPS_KEY ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', textAlign: 'center', color: '#888' }}>
      Google Maps API key not configured — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file.
    </div>
  ) : null

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {errorMsg || <div ref={mapRef} style={{ height: '100%' }} />}
      {selectedCheckin && cardPos && (
        <div style={{ position: 'absolute', left: cardPos.x + 12, top: cardPos.y - 12, zIndex: 10 }}>
          <DetailCard
            checkin={selectedCheckin}
            onClose={() => { setSelectedCheckin(null); setSelectedCheckinId(null); setCardPos(null) }}
          />
        </div>
      )}
    </div>
  )
}
