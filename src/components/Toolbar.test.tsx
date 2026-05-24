import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import Toolbar from './Toolbar'
import { useAppStore } from '../store'

describe('Toolbar', () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

  it('updates search query on input', () => {
    render(<Toolbar />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'coffee' } })
    expect(useAppStore.getState().searchQuery).toBe('coffee')
  })

  it('switches to stats panel on Stats click', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: /stats/i }))
    expect(useAppStore.getState().panelView).toBe('stats')
  })

  it('calls start_sync on refresh click', () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(invoke).toHaveBeenCalledWith('start_sync')
  })
})
