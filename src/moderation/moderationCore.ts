export type ModerationConfig = {
  hashesByTokenCount: Readonly<Record<string, readonly string[]>>
}

type ModerationToken = {
  raw: string
  normalized: string
  start: number
  end: number
}

const lookupCache = new WeakMap<ModerationConfig, Map<number, Set<string>>>()
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u
const DIGIT_SUBSTITUTIONS: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
}
const SYMBOL_SUBSTITUTIONS: Readonly<Record<string, string>> = {
  '@': 'a',
  '$': 's',
  '!': 'i',
}

function isLetterOrNumber(value: string | undefined) {
  return typeof value === 'string' && LETTER_OR_NUMBER.test(value)
}

export function normalizeModerationToken(value: string) {
  const normalized = value.normalize('NFKC').toLowerCase()
  const chars = [...normalized]
  const containsLetter = chars.some((char) => /\p{L}/u.test(char))
  let result = ''

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? ''
    if (/\p{L}/u.test(char)) {
      result += char
      continue
    }
    if (/\p{N}/u.test(char)) {
      result += containsLetter ? (DIGIT_SUBSTITUTIONS[char] ?? char) : char
      continue
    }

    const substitute = SYMBOL_SUBSTITUTIONS[char]
    if (
      substitute
      && isLetterOrNumber(chars[index - 1])
      && isLetterOrNumber(chars[index + 1])
    ) {
      result += substitute
    }
  }

  return result
}

export function hashNormalizedModerationText(value: string) {
  let first = 0x811c9dc5
  let second = 0x9e3779b9

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first ^= code
    first = Math.imul(first, 0x01000193)
    second ^= code + index
    second = Math.imul(second, 0x85ebca6b)
  }

  return `${value.length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`
}

export function tokenizeModerationText(text: string): ModerationToken[] {
  const tokens: ModerationToken[] = []
  const expression = /\S+/gu
  let match: RegExpExecArray | null

  while ((match = expression.exec(text)) !== null) {
    const raw = match[0]
    const normalized = normalizeModerationToken(raw)
    if (!normalized) {
      continue
    }
    tokens.push({
      raw,
      normalized,
      start: match.index,
      end: match.index + raw.length,
    })
  }

  return tokens
}

export function maskConfiguredTerms(text: string, config: ModerationConfig) {
  const lookup = getLookup(config)
  if (lookup.size === 0 || text.length === 0) {
    return text
  }

  const tokens = tokenizeModerationText(text)
  if (tokens.length === 0) {
    return text
  }

  const maskedTokenIndexes = new Set<number>()

  for (const [tokenCount, hashes] of lookup) {
    if (tokenCount <= 0 || hashes.size === 0 || tokenCount > tokens.length) {
      continue
    }

    for (let start = 0; start <= tokens.length - tokenCount; start += 1) {
      const phrase = tokens
        .slice(start, start + tokenCount)
        .map((token) => token.normalized)
        .join(' ')
      if (hashes.has(hashNormalizedModerationText(phrase))) {
        for (let offset = 0; offset < tokenCount; offset += 1) {
          maskedTokenIndexes.add(start + offset)
        }
      }
    }
  }

  const singleTokenHashes = lookup.get(1)
  if (singleTokenHashes && singleTokenHashes.size > 0) {
    for (let start = 0; start < tokens.length; start += 1) {
      let compact = ''
      for (let end = start; end < Math.min(tokens.length, start + 12); end += 1) {
        compact += tokens[end]?.normalized ?? ''
        if (compact.length > 64) {
          break
        }
        if (singleTokenHashes.has(hashNormalizedModerationText(compact))) {
          for (let index = start; index <= end; index += 1) {
            maskedTokenIndexes.add(index)
          }
        }
      }
    }
  }

  if (maskedTokenIndexes.size === 0) {
    return text
  }

  const output = text.split('')
  for (const index of maskedTokenIndexes) {
    const token = tokens[index]
    if (!token) {
      continue
    }
    for (let position = token.start; position < token.end; position += 1) {
      if (!/\s/u.test(output[position] ?? '')) {
        output[position] = '*'
      }
    }
  }
  return output.join('')
}

function getLookup(config: ModerationConfig) {
  const cached = lookupCache.get(config)
  if (cached) {
    return cached
  }

  const compiled = new Map<number, Set<string>>()
  for (const [tokenCountText, hashes] of Object.entries(config.hashesByTokenCount)) {
    const tokenCount = Number(tokenCountText)
    if (Number.isInteger(tokenCount) && tokenCount > 0 && hashes.length > 0) {
      compiled.set(tokenCount, new Set(hashes))
    }
  }
  lookupCache.set(config, compiled)
  return compiled
}
