import { describe, it, expect } from 'bun:test'
import {
  registerEmailProvider,
  unregisterEmailProvider,
  getEmailProvider,
  listEmailProviders,
} from '@/server/email/registry'
import type { EmailProvider } from '@/server/email/types'

function fakeProvider(type: string): EmailProvider {
  return {
    type,
    displayName: type,
    configSchema: [],
    capabilities: {},
    async authenticate() {
      return { valid: true }
    },
    async listMessages() {
      return { messages: [] }
    },
    async getMessage() {
      return { id: '', to: [], subject: '', date: 0, body: '' }
    },
    async sendMessage() {
      return { id: '' }
    },
  }
}

describe('email registry', () => {
  it('registers, gets, lists, and unregisters a provider', () => {
    const p = fakeProvider('test-email-x')
    registerEmailProvider(p)
    expect(getEmailProvider('test-email-x')).toBe(p)
    expect(listEmailProviders().some((x) => x.type === 'test-email-x')).toBe(true)
    unregisterEmailProvider('test-email-x')
    expect(getEmailProvider('test-email-x')).toBeUndefined()
  })

  it('throws on duplicate registration', () => {
    registerEmailProvider(fakeProvider('test-email-dup'))
    expect(() => registerEmailProvider(fakeProvider('test-email-dup'))).toThrow()
    unregisterEmailProvider('test-email-dup')
  })
})
