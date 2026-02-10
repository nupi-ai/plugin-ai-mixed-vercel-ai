import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { Config } from '../config';

export function createProvider(config: Config): LanguageModel {
  const provider = config.provider.toLowerCase();

  // Known providers with dedicated SDK
  // When api_key is provided via config, pass it explicitly.
  // Otherwise fall back to SDK defaults (environment variables).
  if (provider === 'anthropic') {
    if (config.apiKey) {
      return createAnthropic({ apiKey: config.apiKey })(config.model);
    }
    return anthropic(config.model);
  }

  if (provider === 'openai') {
    if (config.apiKey) {
      return createOpenAI({ apiKey: config.apiKey })(config.model);
    }
    return openai(config.model);
  }

  if (provider === 'google') {
    if (config.apiKey) {
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
    }
    return google(config.model);
  }

  if (provider === 'ollama') {
    const ollama = createOpenAI({
      baseURL: config.baseUrl || 'http://localhost:11434/v1',
      apiKey: 'ollama', // Ollama doesn't need real key
    });
    return ollama(config.model);
  }

  // Any other provider - treat as OpenAI-compatible
  // User must provide base_url in config
  if (!config.baseUrl) {
    throw new Error(`Unknown provider "${provider}". For custom providers, set base_url.`);
  }

  const custom = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
  return custom(config.model);
}
