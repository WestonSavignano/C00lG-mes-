import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const runtimeFiles = [
  'api/chat/create.ts',
  'api/chat/join.ts',
  'api/chat/state.ts',
  'api/chat/control.ts',
  'api/chat/signal.ts',
  'server/chat/handlers.ts',
  'server/chat/http.ts',
  'server/chat/inMemoryRoomStore.ts',
  'server/chat/roomService.ts',
  'server/chat/roomStore.ts',
  'server/chat/runtime.ts',
  'server/chat/upstashRoomStore.ts',
]

const relativeImportPattern = /from\s+['"](\.{1,2}\/[^'"]+)['"]/gu

describe('server ESM imports', () => {
  it('uses explicit .js extensions for relative imports that survive Node ESM execution', () => {
    const invalidImports: string[] = []

    for (const file of runtimeFiles) {
      const source = readFileSync(resolve(repoRoot, file), 'utf8')
      for (const match of source.matchAll(relativeImportPattern)) {
        const specifier = match[1]
        if (specifier && !specifier.endsWith('.js')) {
          invalidImports.push(`${file}: ${specifier}`)
        }
      }
    }

    expect(invalidImports).toEqual([])
  })
})
