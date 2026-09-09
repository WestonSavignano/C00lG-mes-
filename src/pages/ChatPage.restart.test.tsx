import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ChatPage from './ChatPage'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location-hash">{location.hash}</output>
}

describe('ChatPage leave-room behavior', () => {
  it('clears the durable room fragment and returns to Start Chat', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/chat#room=invalid']}>
        <Routes>
          <Route
            path="/chat"
            element={(
              <>
                <ChatPage />
                <LocationProbe />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('That chat link cannot be opened')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave room' }))

    expect(screen.getByTestId('location-hash')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'Start Chat' })).toBeEnabled()
  })
})
