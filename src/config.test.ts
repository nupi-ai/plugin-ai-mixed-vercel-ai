import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { loadConfig } from './config';

describe('loadConfig', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NUPI_ADAPTER_CONFIG;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NUPI_ADAPTER_CONFIG;
    } else {
      process.env.NUPI_ADAPTER_CONFIG = originalEnv;
    }
  });

  test('returns defaults when env not set', () => {
    delete process.env.NUPI_ADAPTER_CONFIG;
    const config = loadConfig();
    expect(config.language).toBe('client');
    expect(Object.keys(config.tasks)).toEqual(['user_intent']);
    expect(config.tasks.user_intent.provider).toBe('openai');
    expect(config.tasks.user_intent.model).toBe('gpt-4o-mini');
  });

  test('parses multi-task config', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: {
        user_intent: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
          api_key: 'sk-ant-123',
          max_tokens: 2048,
          temperature: 0.7,
        },
        history_summary: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          api_key: 'sk-456',
          max_tokens: 512,
          temperature: 0.3,
        },
        session_slug: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          api_key: 'sk-456',
          max_tokens: 128,
          temperature: 0.1,
        },
      },
      language: 'Polish',
    });

    const config = loadConfig();
    expect(config.language).toBe('polish');
    expect(Object.keys(config.tasks).sort()).toEqual([
      'history_summary',
      'session_slug',
      'user_intent',
    ]);
    expect(config.tasks.user_intent.provider).toBe('anthropic');
    expect(config.tasks.user_intent.model).toBe('claude-sonnet-4-5-20250929');
    expect(config.tasks.user_intent.apiKey).toBe('sk-ant-123');
    expect(config.tasks.user_intent.maxTokens).toBe(2048);
    expect(config.tasks.history_summary.provider).toBe('openai');
    expect(config.tasks.history_summary.temperature).toBe(0.3);
    expect(config.tasks.session_slug.maxTokens).toBe(128);
  });

  test('applies default maxTokens and temperature', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: {
        user_intent: { provider: 'openai', model: 'gpt-4o' },
      },
    });
    const config = loadConfig();
    expect(config.tasks.user_intent.maxTokens).toBe(1024);
    expect(config.tasks.user_intent.temperature).toBe(0.7);
  });

  test('throws when tasks map is missing', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({ language: 'en' });
    expect(() => loadConfig()).toThrow('"tasks" map is required');
  });

  test('throws when task missing provider', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: { user_intent: { model: 'gpt-4o' } },
    });
    expect(() => loadConfig()).toThrow('requires "provider" and "model"');
  });

  test('throws when task missing model', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: { user_intent: { provider: 'openai' } },
    });
    expect(() => loadConfig()).toThrow('requires "provider" and "model"');
  });

  test('optional fields are undefined when not provided', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: {
        user_intent: { provider: 'openai', model: 'gpt-4o' },
      },
    });
    const config = loadConfig();
    expect(config.tasks.user_intent.apiKey).toBeUndefined();
    expect(config.tasks.user_intent.baseUrl).toBeUndefined();
  });

  test('preserves explicit temperature 0 and max_tokens 0', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: {
        session_slug: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 0,
        },
      },
    });
    const config = loadConfig();
    expect(config.tasks.session_slug.temperature).toBe(0);
    expect(config.tasks.session_slug.maxTokens).toBe(0);
  });

  test('throws when tasks is an array instead of object', () => {
    process.env.NUPI_ADAPTER_CONFIG = JSON.stringify({
      tasks: [{ provider: 'openai', model: 'gpt-4o' }],
    });
    expect(() => loadConfig()).toThrow('"tasks" map is required');
  });
});
