import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LoadingScreen from './LoadingScreen'
import { useAppStore } from '../store'

describe('LoadingScreen', () => {
  it('shows progress when available', () => {
    useAppStore.setState({ syncProgress: { loaded: 142, total: 600 } })
    render(<LoadingScreen />)
    expect(screen.getByText(/142.*600/)).toBeInTheDocument()
  })

  it('shows generic message when no progress yet', () => {
    useAppStore.setState({ syncProgress: null })
    render(<LoadingScreen />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
