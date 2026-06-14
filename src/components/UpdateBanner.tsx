import type { UpdaterApi } from '../hooks/useAppUpdater'

function pct(loaded: number, total: number | null): string {
  if (total == null || total === 0) return ''
  return `${Math.min(100, Math.round((loaded / total) * 100))}%`
}

export default function UpdateBanner({ updater }: { updater: UpdaterApi }) {
  const { phase, install, dismiss } = updater
  if (phase.kind === 'idle') return null

  const isBusy = phase.kind === 'downloading' || phase.kind === 'installing'
  const version =
    phase.kind === 'error' ? null :
    phase.kind === 'available' ? phase.update.version :
    phase.kind === 'downloading' ? phase.update.version :
    phase.kind === 'installing' ? phase.update.version : null

  let label = ''
  if (phase.kind === 'available') label = `Flock ${version} is available`
  else if (phase.kind === 'downloading') {
    const p = pct(phase.loaded, phase.total)
    label = p ? `Downloading ${version}… ${p}` : `Downloading ${version}…`
  } else if (phase.kind === 'installing') label = `Installing ${version}… Flock will relaunch.`
  else label = `Couldn't install update: ${phase.message}`

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 22px',
        background: phase.kind === 'error' ? '#FEF2F2' : 'var(--accent-soft)',
        borderBottom: `1px solid ${phase.kind === 'error' ? '#FCA5A5' : '#f4d4a8'}`,
        fontSize: 12, fontFamily: 'var(--sans)',
        color: phase.kind === 'error' ? '#991B1B' : 'var(--ink)',
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 600, flexShrink: 0 }}>↻</span>
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{label}</span>
      {phase.kind === 'available' && (
        <>
          <button
            onClick={install}
            style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 12,
              fontFamily: 'var(--sans)', fontWeight: 600,
              border: 'none', background: 'var(--accent)', color: '#fff',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Install update
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: '0 4px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </>
      )}
      {phase.kind === 'error' && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#991B1B', fontSize: 16, lineHeight: 1, padding: '0 4px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
      {isBusy && (
        <span style={{ width: 14, height: 14, flexShrink: 0 }}>
          <svg viewBox="0 0 14 14" style={{ animation: 'spin 900ms linear infinite' }}>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.25" />
            <path d="M 12.5 7 A 5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </span>
      )}
    </div>
  )
}
