import { describe, expect, it } from 'vitest'
import { ChatRateLimiter } from './chatRateLimiter'

describe('ChatRateLimiter', () => {
  it('uses a bounded per-member token bucket without coupling members together', () => {
    let now = 1_000
    const limiter = new ChatRateLimiter({ capacity: 5, refillPerSecond: 1, now: () => now })

    for (let index = 0; index < 5; index += 1) {
      expect(limiter.tryConsume('member-a')).toBe(true)
    }
    expect(limiter.tryConsume('member-a')).toBe(false)
    expect(limiter.tryConsume('member-b')).toBe(true)

    now += 1_000
    expect(limiter.tryConsume('member-a')).toBe(true)
    expect(limiter.tryConsume('member-a')).toBe(false)
  })
})
