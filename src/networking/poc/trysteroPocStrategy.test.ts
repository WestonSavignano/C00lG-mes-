import { describe, expect, it } from 'vitest'
import {
  buildPocStrategyConfig,
  getPocModuleUrl,
  parsePocStrategy,
  withPocStrategy,
} from './trysteroPocStrategy'

describe('Trystero POC rendezvous strategy selection', () => {
  it('defaults to Nostr and accepts the BitTorrent and event-driven Nostr candidates explicitly', () => {
    expect(parsePocStrategy('')).toBe('nostr')
    expect(parsePocStrategy('?strategy=nostr')).toBe('nostr')
    expect(parsePocStrategy('?strategy=torrent')).toBe('torrent')
    expect(parsePocStrategy('?strategy=nostr-wake')).toBe('nostr-wake')
    expect(parsePocStrategy('?strategy=nostr-fast')).toBe('nostr')
    expect(parsePocStrategy('?strategy=unknown')).toBe('nostr')
  })

  it('pins all strategies to Trystero 0.25.4', () => {
    expect(getPocModuleUrl('nostr')).toBe('https://esm.run/trystero@0.25.4')
    expect(getPocModuleUrl('nostr-wake')).toBe('https://esm.run/trystero@0.25.4')
    expect(getPocModuleUrl('torrent')).toBe('https://esm.run/@trystero-p2p/torrent@0.25.4')
  })

  it('keeps active-host/passive-guest behavior equivalent while respecting each strategy ICE mode', () => {
    expect(buildPocStrategyConfig('nostr', 'host', 'secret')).toMatchObject({
      password: 'secret',
      passive: false,
      trickleIce: true,
    })
    expect(buildPocStrategyConfig('nostr-wake', 'host', 'secret')).toMatchObject({
      password: 'secret',
      passive: false,
      trickleIce: true,
    })
    expect(buildPocStrategyConfig('nostr-wake', 'guest', 'secret')).toMatchObject({
      password: 'secret',
      passive: true,
      trickleIce: true,
    })
    expect(buildPocStrategyConfig('torrent', 'guest', 'secret')).toMatchObject({
      password: 'secret',
      passive: true,
      trickleIce: false,
    })
  })

  it('carries the chosen strategy into host and guest links without putting it in the fragment', () => {
    const url = new URL('https://coolgamesplus.com/networking-poc/trystero#role=guest&party=abc')
    withPocStrategy(url, 'nostr-wake')

    expect(url.search).toBe('?strategy=nostr-wake')
    expect(url.hash).toBe('#role=guest&party=abc')
  })
})
