export async function deriveCredentialVerifier(secret: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable; guest authentication cannot proceed safely')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const encoded = btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
  return `sha256:${encoded}`
}
