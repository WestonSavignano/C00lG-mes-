import { describe, expect, it } from 'vitest'
import {
  buildPocStrategyConfig,
  getPocModuleUrl,
  parsePocStrategy,
  withPocStrategy,
} from './trysteroPocStrategy'

describe('Trystero POC rendezvous strategy selection', () => {
  it('defaults to Nostr and accepts the BitTorrent candidate explicitly', () => {
    expect(parsePocStrategy('')).toBe('nostr')
    expect(parsePocStrategy('?strategy=nostr')).toBe('nostr')
    expect(parsePocStrategy('?strategy=torrent')).toBe('torrent')
    expect(parsePocStrategy('?strategy=unknown')).toBe('nostr')
  })

  it('pins both strategies to Trystero 0.25.4', () => {
    expect(getPocModuleUrl('nostr')).toBe('https://esm.run/trystero@0.25.4')
    expect(getPocModuleUrl('torrent')).toBe('https://esm.run/@trystero-p2p/torrent@0.25.4')
  })

  it('keeps active-host/passive-guest and trickle ICE equivalent across strategies', () => {
    expect(buildPocStrategyConfig('host', 'secret')).toMatchObject({
      password: 'secret',
      passive: false,
      trickleIce: true,
    })
    expect(buildPocStrategyConfig('guest', 'secret')).toMatchObject({
      password: 'secret',
      passive: true,
      trickleIce: true,
    })
  })

  it('carries the chosen strategy into host and guest links without putting it in the fragment', () => {
    const url = new URL('https://coolgamesplus.com/networking-poc/trystero#role=guest&party=abc')
    withPocStrategy(url, 'torrent')

    expect(url.search).toBe('?strategy=torrent')
    expect(url.hash).toBe('#role=guest&party=abc')
  })
})
