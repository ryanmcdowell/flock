import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import ConnectScreen from './ConnectScreen'

describe('ConnectScreen', () => {
  it('renders connect button', () => {
    render(<ConnectScreen />)
    expect(screen.getByRole('button', { name: /connect to swarm/i })).toBeInTheDocument()
  })

  it('calls start_oauth on click', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    render(<ConnectScreen />)
    fireEvent.click(screen.getByRole('button', { name: /connect to swarm/i }))
    expect(invoke).toHaveBeenCalledWith('start_oauth')
  })
})
