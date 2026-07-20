import type {
  ChannelAdapter,
  ChannelAdapterMeta,
  ChannelConfigSchema,
  IncomingMessageHandler,
  OutboundMessageParams,
  OutboundMessageResult,
} from '@/server/channels/adapter'

const DEFAULT_PUBLIC_URL = 'https://chat.gezytech.web.id/webchat/'

const websiteConfigSchema: ChannelConfigSchema = {
  fields: [
    {
      name: 'publicUrl',
      label: 'Public web chat URL',
      type: 'text',
      required: true,
      default: DEFAULT_PUBLIC_URL,
      placeholder: DEFAULT_PUBLIC_URL,
      description: 'The browser-facing URL where visitors open this Agent web chat.',
    },
  ],
}

function normalizePublicUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Passive adapter for first-party public web chat surfaces. Unlike Telegram or
 * Discord, the browser app initiates inbound messages over HTTP, so activation
 * only marks the channel as available and exposes its public entry URL.
 */
export class WebsiteAdapter implements ChannelAdapter {
  readonly platform = 'website'
  readonly meta: ChannelAdapterMeta = { displayName: 'Web Chat', brandColor: '#00BFA6' }
  readonly configSchema = websiteConfigSchema
  readonly identitySwitchMode = 'none' as const

  async start(
    _channelId: string,
    _config: Record<string, unknown>,
    _onMessage: IncomingMessageHandler,
  ): Promise<void> {
    // Browser-originated traffic is handled by the public webchat service.
  }

  async stop(_channelId: string): Promise<void> {
    // Nothing to tear down for a passive browser channel.
  }

  async sendMessage(
    _channelId: string,
    _config: Record<string, unknown>,
    _params: OutboundMessageParams,
  ): Promise<OutboundMessageResult> {
    throw new Error('Web Chat channels are browser-initiated; send replies through the active webchat session.')
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    const publicUrl = normalizePublicUrl(config.publicUrl)
    if (!publicUrl) return { valid: false, error: 'Public web chat URL is required' }
    if (!isHttpUrl(publicUrl)) return { valid: false, error: 'Public web chat URL must be an http(s) URL' }
    return { valid: true }
  }

  async getBotInfo(config: Record<string, unknown>): Promise<{ name: string; username?: string } | null> {
    const publicUrl = normalizePublicUrl(config.publicUrl)
    try {
      const url = new URL(publicUrl)
      return { name: 'Web Chat', username: url.hostname }
    } catch {
      return { name: 'Web Chat' }
    }
  }
}
