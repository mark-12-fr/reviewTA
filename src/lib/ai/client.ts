import { AINotConfiguredError, chooseProviderId, isAIConfigured, type Provider } from './provider'
import { anthropicProvider, describeAnthropicError } from './providers/anthropic'
import { geminiProvider } from './providers/gemini'

export { AINotConfiguredError, isAIConfigured }

function providerFor(id: 'anthropic' | 'gemini'): Provider {
  return id === 'anthropic' ? anthropicProvider : geminiProvider
}

/** The provider this install is configured to use. Throws when there is no key. */
export function getProvider(): Provider {
  const id = chooseProviderId()
  if (!id) throw new AINotConfiguredError()
  return providerFor(id)
}

export function providerInfo() {
  const id = chooseProviderId()
  if (!id) return { configured: false, provider: null, label: null, model: null, free: false }

  const provider = providerFor(id)
  return {
    configured: true,
    provider: provider.id,
    label: provider.label,
    model: provider.model,
    free: provider.free,
  }
}

export function describeAIError(error: unknown): string {
  if (error instanceof AINotConfiguredError) return error.message

  const anthropicMessage = describeAnthropicError(error)
  if (anthropicMessage) return anthropicMessage

  return error instanceof Error ? error.message : 'Something went wrong.'
}
