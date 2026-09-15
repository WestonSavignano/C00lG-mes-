import { buildTrysteroConfig, type PocRole } from './trysteroPocModel'

export type PocStrategy = 'nostr' | 'nostr-fast' | 'torrent'

export const TRYSTERO_POC_VERSION = '0.25.4'

export function parsePocStrategy(search: string): PocStrategy {
  const strategy = new URLSearchParams(search).get('strategy')
  if (strategy === 'torrent' || strategy === 'nostr-fast') return strategy
  return 'nostr'
}

export function getPocModuleUrl(strategy: PocStrategy) {
  return strategy === 'torrent'
    ? `https://esm.run/@trystero-p2p/torrent@${TRYSTERO_POC_VERSION}`
    : `https://esm.run/trystero@${TRYSTERO_POC_VERSION}`
}

export function buildPocStrategyConfig(
  strategy: PocStrategy,
  role: PocRole,
  secret: string,
) {
  return {
    ...buildTrysteroConfig(role, secret),
    trickleIce: strategy !== 'torrent',
  }
}

export function withPocStrategy(url: URL, strategy: PocStrategy) {
  url.searchParams.set('strategy', strategy)
  return url
}
