import {
  hashNormalizedModerationText,
  tokenizeModerationText,
  type ModerationConfig,
} from './moderationCore'

export function buildModerationConfig(rawTerms: string | undefined): ModerationConfig {
  if (!rawTerms?.trim()) {
    return { hashesByTokenCount: {} }
  }

  const hashes = new Map<number, Set<string>>()
  for (const rawTerm of rawTerms.split(',')) {
    const term = rawTerm.trim()
    if (!term) {
      continue
    }

    const tokens = tokenizeModerationText(term)
    if (tokens.length === 0) {
      continue
    }

    const normalized = tokens.map((token) => token.normalized).join(' ')
    const group = hashes.get(tokens.length) ?? new Set<string>()
    group.add(hashNormalizedModerationText(normalized))
    hashes.set(tokens.length, group)
  }

  const hashesByTokenCount: Record<string, readonly string[]> = {}
  for (const [tokenCount, values] of [...hashes.entries()].sort(([left], [right]) => left - right)) {
    hashesByTokenCount[String(tokenCount)] = [...values].sort()
  }

  return { hashesByTokenCount }
}
