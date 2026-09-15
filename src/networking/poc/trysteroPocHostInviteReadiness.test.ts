import { describe, expect, it, vi } from 'vitest'
import * as wakeModule from './trysteroPocNostrWake'

describe('host invite readiness', () => {
  it('becomes ready exactly once when root and wake subscriptions are ready on the same relay', () => {
    const createTracker = Reflect.get(wakeModule, 'createPocHostInviteReadinessTracker')
    expect(createTracker).toBeTypeOf('function')

    const onReady = vi.fn()
    const tracker = createTracker(onReady) as {
      markRootReady(relayUrl: string): void
      markWakeReady(relayUrl: string): void
    }

    tracker.markRootReady('wss://relay.test/')
    expect(onReady).not.toHaveBeenCalled()

    tracker.markWakeReady('wss://other.test')
    expect(onReady).not.toHaveBeenCalled()

    tracker.markWakeReady('wss://relay.test')
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledWith('wss://relay.test')

    tracker.markRootReady('wss://other.test/')
    tracker.markWakeReady('wss://relay.test/')
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('reports host readiness to both the page evidence log and browser console', () => {
    const reportReady = Reflect.get(wakeModule, 'reportPocHostInviteReady')
    expect(reportReady).toBeTypeOf('function')

    const addLog = vi.fn()
    const consoleInfo = vi.fn()
    reportReady(addLog, consoleInfo)

    expect(addLog).toHaveBeenCalledWith('HOST READY — paste/open the guest invite now')
    expect(consoleInfo).toHaveBeenCalledWith('HOST READY — paste/open the guest invite now')
  })

  it('streams sanitized event diagnostics to the browser console as they occur', () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    wakeModule.resetPocNostrWakeDiagnostics()

    wakeModule.recordPocNostrWakeDiagnostic('guest-wake-sent', {
      relayUrl: 'wss://relay.test/',
    })

    expect(consoleInfo).toHaveBeenCalledWith(
      '[Trystero POC:event]',
      expect.objectContaining({
        stage: 'guest-wake-sent',
        relayUrl: 'wss://relay.test/',
      }),
    )

    consoleInfo.mockRestore()
  })
})
