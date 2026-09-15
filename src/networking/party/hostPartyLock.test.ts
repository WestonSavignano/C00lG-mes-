import { describe, expect, it } from 'vitest'
import { acquireHostPartyLock, type LockManagerLike } from './hostPartyLock'

class FakeLockManager implements LockManagerLike {
  private held = new Set<string>()

  async request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: { name: string; mode: 'exclusive' } | null) => Promise<T> | T,
  ): Promise<T> {
    expect(options).toEqual({ mode: 'exclusive', ifAvailable: true })
    if (this.held.has(name)) {
      return callback(null)
    }
    this.held.add(name)
    try {
      return await callback({ name, mode: 'exclusive' })
    } finally {
      this.held.delete(name)
    }
  }
}

describe('host party Web Lock', () => {
  it('allows only one same-origin host writer for a party and releases cleanly', async () => {
    const manager = new FakeLockManager()
    const first = await acquireHostPartyLock('party-a', manager)

    await expect(acquireHostPartyLock('party-a', manager)).rejects.toThrow('already active')

    first.release()
    await first.released

    const replacement = await acquireHostPartyLock('party-a', manager)
    replacement.release()
    await replacement.released
  })

  it('fails closed when Web Locks are unavailable instead of using a localStorage lease', async () => {
    await expect(acquireHostPartyLock('party-a', null)).rejects.toThrow('Web Locks are unavailable')
  })
})
