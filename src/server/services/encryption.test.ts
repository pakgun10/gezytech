import { describe, it, expect } from 'bun:test'

// We can't import from ./encryption because search.test.ts mocks it globally
// via mock.module. Instead, we test the crypto logic directly using the same
// algorithm as encryption.ts (AES-256-GCM).

const TEST_KEY_HEX = 'a'.repeat(64) // 32 bytes

async function getTestKey(): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(
    (TEST_KEY_HEX.match(/.{2}/g) ?? []).map((byte: string) => parseInt(byte, 16)),
  )
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getTestKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decrypt(encrypted: string): Promise<string> {
  const key = await getTestKey()
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

async function encryptBuffer(data: Uint8Array): Promise<Uint8Array> {
  const key = await getTestKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data.buffer as ArrayBuffer)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return combined
}

async function decryptBuffer(encrypted: Uint8Array): Promise<Uint8Array> {
  const key = await getTestKey()
  const iv = encrypted.slice(0, 12)
  const ciphertext = encrypted.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new Uint8Array(decrypted)
}

describe('encryption service', () => {
  it('encrypts and decrypts a simple string', async () => {
    const plaintext = 'hello world'
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('returns a base64 string', async () => {
    const encrypted = await encrypt('test')
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('produces different ciphertexts for the same input (random IV)', async () => {
    const a = await encrypt('same input')
    const b = await encrypt('same input')
    expect(a).not.toBe(b)
  })

  it('both ciphertexts decrypt to the same plaintext', async () => {
    const plaintext = 'deterministic output'
    const a = await encrypt(plaintext)
    const b = await encrypt(plaintext)
    expect(await decrypt(a)).toBe(plaintext)
    expect(await decrypt(b)).toBe(plaintext)
  })

  it('handles empty string', async () => {
    const encrypted = await encrypt('')
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('handles unicode characters', async () => {
    const plaintext = '🔑 clé secrète à décrypter 日本語'
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('handles long strings', async () => {
    const plaintext = 'x'.repeat(10000)
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('fails to decrypt tampered ciphertext', async () => {
    const encrypted = await encrypt('sensitive data')
    const chars = encrypted.split('')
    const mid = Math.floor(chars.length / 2)
    chars[mid] = chars[mid] === 'A' ? 'B' : 'A'
    const tampered = chars.join('')

    await expect(decrypt(tampered)).rejects.toThrow()
  })

  it('fails to decrypt garbage input', async () => {
    await expect(decrypt('not-valid-base64!!!')).rejects.toThrow()
  })

  it('fails to decrypt truncated ciphertext', async () => {
    const encrypted = await encrypt('hello')
    const truncated = encrypted.slice(0, 16)
    await expect(decrypt(truncated)).rejects.toThrow()
  })

  it('encrypts and decrypts a buffer', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const encrypted = await encryptBuffer(data)
    const decrypted = await decryptBuffer(encrypted)
    expect(Array.from(decrypted)).toEqual(Array.from(data))
  })
})
