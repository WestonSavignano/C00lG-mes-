export type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: { name: string; mode: 'exclusive' } | null) => Promise<T> | T,
  ): Promise<T>
}

export type HostPartyLockLease = {
  name: string
  release: () => void
  released: Promise<void>
}

export async function acquireHostPartyLock(
  partyId: string,
  manager: LockManagerLike | null = typeof navigator !== 'undefined' && 'locks' in navigator
    ? (navigator.locks as unknown as LockManagerLike)
    : null,
): Promise<HostPartyLockLease> {
  if (!manager) {
    throw new Error('Web Locks are unavailable in this browser')
  }

  const name = `coolgamesplus:party-host:${partyId}`
  let resolveAcquired: (lease: HostPartyLockLease) => void = () => undefined
  let rejectAcquired: (error: Error) => void = () => undefined
  const acquired = new Promise<HostPartyLockLease>((resolve, reject) => {
    resolveAcquired = resolve
    rejectAcquired = reject
  })

  let resolveRelease: () => void = () => undefined
  const releaseSignal = new Promise<void>((resolve) => {
    resolveRelease = resolve
  })

  let resolveReleased: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    resolveReleased = resolve
  })

  void manager.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (!lock) {
      rejectAcquired(new Error('Another host tab is already active for this party'))
      return
    }

    let releasedOnce = false
    const lease: HostPartyLockLease = {
      name,
      release: () => {
        if (!releasedOnce) {
          releasedOnce = true
          resolveRelease()
        }
      },
      released,
    }
    resolveAcquired(lease)
    try {
      await releaseSignal
    } finally {
      resolveReleased()
    }
  }).catch((error: unknown) => {
    rejectAcquired(error instanceof Error ? error : new Error('Unable to acquire host Web Lock'))
    resolveReleased()
  })

  return acquired
}
