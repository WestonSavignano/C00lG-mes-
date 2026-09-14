import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function readPngDimensions(relativePath: string) {
  const file = readFileSync(new URL(relativePath, import.meta.url))

  expect(file.subarray(0, pngSignature.length)).toEqual(pngSignature)

  return {
    bytes: file.byteLength,
    height: file.readUInt32BE(20),
    width: file.readUInt32BE(16),
  }
}

describe('production brand assets', () => {
  it('ships semantic PNG derivatives at the intended pixel sizes', () => {
    const source = readPngDimensions('../public/brand-mark-source.png')
    const header = readPngDimensions('../public/brand-mark.png')
    const favicon = readPngDimensions('../public/site-favicon.png')
    const appleTouchIcon = readPngDimensions('../public/apple-touch-icon.png')

    expect(source).toMatchObject({ width: 1254, height: 1254 })
    expect(header).toMatchObject({ width: 102, height: 102 })
    expect(favicon).toMatchObject({ width: 48, height: 48 })
    expect(appleTouchIcon).toMatchObject({ width: 180, height: 180 })

    expect(header.bytes).toBeLessThan(source.bytes)
    expect(favicon.bytes).toBeLessThan(source.bytes)
    expect(appleTouchIcon.bytes).toBeLessThan(source.bytes)
  })

  it('keeps document metadata plain while wiring the production favicon and touch icon', () => {
    const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

    expect(indexHtml).toContain(
      '<link rel="icon" type="image/png" sizes="48x48" href="/site-favicon.png" />',
    )
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
    )
    expect(indexHtml).toContain('<title>Cool Games Plus</title>')
    expect(indexHtml).not.toContain('favicon.svg')
    expect(indexHtml).not.toContain('href="/favicon.png"')
  })
})
