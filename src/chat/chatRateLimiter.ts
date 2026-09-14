type Bucket = {
  tokens: number
  updatedAt: number
}

export class ChatRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private readonly capacity: number
  private readonly refillPerSecond: number
  private readonly now: () => number

  constructor(input: {
    capacity?: number
    refillPerSecond?: number
    now?: () => number
  } = {}) {
    this.capacity = input.capacity ?? 5
    this.refillPerSecond = input.refillPerSecond ?? 1
    this.now = input.now ?? Date.now

    if (!Number.isFinite(this.capacity) || this.capacity <= 0) {
      throw new Error('Chat rate-limit capacity must be positive')
    }
    if (!Number.isFinite(this.refillPerSecond) || this.refillPerSecond < 0) {
      throw new Error('Chat rate-limit refill must be non-negative')
    }
  }

  tryConsume(memberId: string) {
    const now = this.now()
    const previous = this.buckets.get(memberId) ?? { tokens: this.capacity, updatedAt: now }
    const elapsedSeconds = Math.max(0, now - previous.updatedAt) / 1_000
    const tokens = Math.min(this.capacity, previous.tokens + elapsedSeconds * this.refillPerSecond)

    if (tokens < 1) {
      this.buckets.set(memberId, { tokens, updatedAt: now })
      return false
    }

    this.buckets.set(memberId, { tokens: tokens - 1, updatedAt: now })
    return true
  }

  clear(memberId: string) {
    this.buckets.delete(memberId)
  }
}
