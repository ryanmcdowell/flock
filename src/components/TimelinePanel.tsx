import { List, useListRef } from 'react-window'
import { useEffect } from 'react'
import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import TimelineRow from './TimelineRow'
import type { CheckIn } from '../types'

const ROW_HEIGHT = 80

interface RowProps {
  checkins: CheckIn[]
}

function Row({ index, style, checkins }: { index: number; style: React.CSSProperties } & RowProps) {
  return <TimelineRow checkin={checkins[index]} style={style} />
}

export default function TimelinePanel() {
  const filteredCheckins = useFilteredCheckins()
  const selectedCheckinId = useAppStore(s => s.selectedCheckinId)
  const listRef = useListRef(null)

  // Scroll to selected item when changed from map
  useEffect(() => {
    if (!selectedCheckinId) return
    const idx = filteredCheckins.findIndex(c => c.id === selectedCheckinId)
    if (idx >= 0) listRef.current?.scrollToRow({ index: idx, align: 'smart' })
  }, [selectedCheckinId])

  if (filteredCheckins.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '32px' }}>🔍</span>
        <p style={{ margin: 0 }}>No check-ins match your search.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <List<RowProps>
        listRef={listRef}
        defaultHeight={window.innerHeight - 48}
        rowCount={filteredCheckins.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={Row}
        rowProps={{ checkins: filteredCheckins }}
        style={{ height: window.innerHeight - 48, width: '100%' }}
      />
    </div>
  )
}
