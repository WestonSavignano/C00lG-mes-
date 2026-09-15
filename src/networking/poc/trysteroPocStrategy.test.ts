import { describe, expect, it } from 'vitest'
import {
  buildPocStrategyConfig,
  getPocModuleUrl,
  parsePocStrategy,
  withPocStrategy,
} from './trysteroPocStrategy'

describe('Trystero POC rendezvous strategy selection', () => {
  it('defaults to Nostr and accepts the BitTorrent and fast-Nostr candidates explicitly', () => {
    expect(parsePocStrategy('')).toBe('nostr')
    expect(parsePocStrategy('?strategy=nostr')).toBe('nostr')
    expect(parsePocStrategy('?strategy=torrent')).toBe('torrent')
    expect(parsePocStrategy('?strategy=nostr-fast')).toBe('nostr-fast')
    expect(parsePocStrategy('?strategy=unknown')).toBe('nostr')
  })

  it('pins all strategies to Trystero 0.25.4', () => {
    expect(getPocModuleUrl('nostr')).toBe('https://esm.run/trystero@0.25.4')
    expect(getPocModuleUrl('nostr-fast')).toBe('https://esm.run/trystero@0.25.4')
    expect(getPocModuleUrl('torrent')).toBe('https://esm.run/@trystero-p2p/torrent@0.25.4')
  })

  it('keeps active-host/passive-guest behavior equivalent while respecting each strategy ICE mode', () => {
    expect(buildPocStrategyConfig('nostr', 'host', 'secret')).toMatchObject({
      password: 'secret',
      passive: false,
      trickleIce: true,
    })
    expect(buildPocStrategyConfig('nostr-fast', 'host', 'secret')).toMatchObject({
      password: 'secret',
      passive: false,
      trickleIce: true,
    })
    expect(buildPocStrategyConfig('nostr-fast', 'guest', 'secret')).toMatchObject({
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
    withPocStrategy(url, 'nostr-fast')

    expect(url.search).toBe('?strategy=nostr-fast')
    expect(url.hash).toBe('#role=guest&party=abc')
  })
})
