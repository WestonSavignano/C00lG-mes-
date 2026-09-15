import { buildTrysteroConfig, type PocRole } from './trysteroPocModel'

export type PocStrategy = 'nostr' | 'torrent'

export const TRYSTERO_POC_VERSION = '0.25.4'

export function parsePocStrategy(search: string): PocStrategy {
  return new URLSearchParams(search).get('strategy') === 'torrent' ? 'torrent' : 'nostr'
}

export function getPocModuleUrl(strategy: PocStrategy) {
  return strategy === 'torrent'
    ? `https://esm.run/@trystero-p2p/torrent@${TRYSTERO_POC_VERSION}`
    : `https://esm.run/trystero@${TRYSTERO_POC_VERSION}`
}

export function buildPocStrategyConfig(role: PocRole, secret: string) {
  return {
    ...buildTrysteroConfig(role, secret),
    trickleIce: true,
  }
}

export function withPocStrategy(url: URL, strategy: PocStrategy) {
  url.searchParams.set('strategy', strategy)
  return url
}
