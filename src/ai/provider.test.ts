import { describe, expect, test } from 'bun:test';
import { ModelRouter, MissingTaskConfigError, createEmbeddingModel, SUMMARIZATION_EVENT_TYPES } from './provider';
import type { Config } from '../config';

function makeConfig(tasks: Record<string, { provider: string; model: string }>): Config {
  const full: Config['tasks'] = {};
  for (const [key, val] of Object.entries(tasks)) {
    full[key] = {
      provider: val.provider,
      model: val.model,
      maxTokens: 1024,
      temperature: 0.7,
    };
  }
  return { tasks: full, language: 'client' };
}

describe('ModelRouter', () => {
  test('getRoute returns a model for configured event type', () => {
    const config = makeConfig({ user_intent: { provider: 'openai', model: 'gpt-4o-mini' } });
    const router = new ModelRouter(config);
    const { model, taskConfig } = router.getRoute('user_intent');
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('gpt-4o-mini');
    expect(taskConfig.provider).toBe('openai');
    expect(taskConfig.model).toBe('gpt-4o-mini');
  });

  test('getRoute caches instances (same object on second call)', () => {
    const config = makeConfig({ user_intent: { provider: 'openai', model: 'gpt-4o-mini' } });
    const router = new ModelRouter(config);
    const r1 = router.getRoute('user_intent');
    const r2 = router.getRoute('user_intent');
    expect(r1.model).toBe(r2.model);
    expect(r1.taskConfig).toBe(r2.taskConfig);
  });

  test('getRoute returns different models for different event types', () => {
    const config = makeConfig({
      user_intent: { provider: 'openai', model: 'gpt-4o' },
      journal_compaction: { provider: 'openai', model: 'gpt-4o-mini' },
    });
    const router = new ModelRouter(config);
    const r1 = router.getRoute('user_intent');
    const r2 = router.getRoute('journal_compaction');
    expect((r1.model as any).modelId).toBe('gpt-4o');
    expect((r2.model as any).modelId).toBe('gpt-4o-mini');
  });

  test('getRoute throws MissingTaskConfigError for missing event type', () => {
    const config = makeConfig({
      user_intent: { provider: 'openai', model: 'gpt-4o-mini' },
      journal_compaction: { provider: 'openai', model: 'gpt-4o-mini' },
    });
    const router = new ModelRouter(config);
    expect(() => router.getRoute('clarification')).toThrow(MissingTaskConfigError);

    // Verify error properties
    try {
      router.getRoute('clarification');
    } catch (err) {
      const e = err as MissingTaskConfigError;
      expect(e.eventType).toBe('clarification');
      expect(e.availableTasks).toEqual(['user_intent', 'journal_compaction']);
      expect(e.message).toContain("No configuration for event_type 'clarification'");
    }
  });

  test('getRoute with empty string defaults to user_intent', () => {
    const config = makeConfig({ user_intent: { provider: 'openai', model: 'gpt-4o-mini' } });
    const router = new ModelRouter(config);
    const { model } = router.getRoute('');
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('gpt-4o-mini');
  });

  test('getRoute with unspecified defaults to user_intent (cached)', () => {
    const config = makeConfig({ user_intent: { provider: 'openai', model: 'gpt-4o-mini' } });
    const router = new ModelRouter(config);
    const r1 = router.getRoute('');
    const r2 = router.getRoute('user_intent');
    expect(r1.model).toBe(r2.model);
  });

  test('resolveKey maps empty to user_intent', () => {
    const config = makeConfig({ user_intent: { provider: 'openai', model: 'gpt-4o-mini' } });
    const router = new ModelRouter(config);
    expect(router.resolveKey('')).toBe('user_intent');
    expect(router.resolveKey('journal_compaction')).toBe('journal_compaction');
  });

  test('getRoute falls back to summarization config for summarization event types', () => {
    const config = makeConfig({
      user_intent: { provider: 'openai', model: 'gpt-4o' },
      summarization: { provider: 'openai', model: 'gpt-4o-mini' },
    });
    const router = new ModelRouter(config);

    const results: ReturnType<ModelRouter['getRoute']>[] = [];
    for (const eventType of SUMMARIZATION_EVENT_TYPES) {
      const result = router.getRoute(eventType);
      expect(result.model).toBeDefined();
      expect((result.model as any).modelId).toBe('gpt-4o-mini');
      expect(result.taskConfig.model).toBe('gpt-4o-mini');
      results.push(result);
    }

    // All share the same taskConfig (from summarization slot)
    expect(results[0].taskConfig).toBe(results[1].taskConfig);
    expect(results[1].taskConfig).toBe(results[2].taskConfig);

    // But each event type gets its own cache entry
    const r1again = router.getRoute('journal_compaction');
    expect(r1again).toBe(results[0]);
    const r2again = router.getRoute('conversation_compaction');
    expect(r2again).toBe(results[1]);
  });

  test('getRoute throws when summarization event type has no config and no summarization fallback', () => {
    const config = makeConfig({
      user_intent: { provider: 'openai', model: 'gpt-4o' },
    });
    const router = new ModelRouter(config);
    expect(() => router.getRoute('journal_compaction')).toThrow(MissingTaskConfigError);
    expect(() => router.getRoute('conversation_compaction')).toThrow(MissingTaskConfigError);
    expect(() => router.getRoute('scheduled_task')).toThrow(MissingTaskConfigError);
  });

  test('explicit task config overrides summarization fallback', () => {
    const config = makeConfig({
      user_intent: { provider: 'openai', model: 'gpt-4o' },
      summarization: { provider: 'openai', model: 'gpt-4o-mini' },
      journal_compaction: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    });
    const router = new ModelRouter(config);

    // journal_compaction uses its own explicit config
    const r1 = router.getRoute('journal_compaction');
    expect((r1.model as any).modelId).toBe('claude-haiku-4-5-20251001');
    expect(r1.taskConfig.provider).toBe('anthropic');

    // conversation_compaction and scheduled_task fall back to summarization
    const r2 = router.getRoute('conversation_compaction');
    expect((r2.model as any).modelId).toBe('gpt-4o-mini');
    expect(r2.taskConfig.provider).toBe('openai');

    const r3 = router.getRoute('scheduled_task');
    expect((r3.model as any).modelId).toBe('gpt-4o-mini');
    expect(r3.taskConfig.provider).toBe('openai');
  });

  test('getRoute does not fall back to summarization for primary event types', () => {
    const config = makeConfig({
      user_intent: { provider: 'openai', model: 'gpt-4o' },
      summarization: { provider: 'openai', model: 'gpt-4o-mini' },
    });
    const router = new ModelRouter(config);
    expect(() => router.getRoute('clarification')).toThrow(MissingTaskConfigError);
    expect(() => router.getRoute('session_output')).toThrow(MissingTaskConfigError);
  });
});

describe('createEmbeddingModel', () => {
  test('creates OpenAI embedding model', () => {
    const model = createEmbeddingModel({
      provider: 'openai', model: 'text-embedding-3-small', maxTokens: 0, temperature: 0,
    });
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('text-embedding-3-small');
  });

  test('creates Google embedding model', () => {
    const model = createEmbeddingModel({
      provider: 'google', model: 'text-embedding-004', maxTokens: 0, temperature: 0,
    });
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('text-embedding-004');
  });

  test('creates Ollama embedding model via OpenAI-compatible', () => {
    const model = createEmbeddingModel({
      provider: 'ollama', model: 'nomic-embed-text', maxTokens: 0, temperature: 0,
    });
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('nomic-embed-text');
  });

  test('throws for Anthropic provider (no embedding support)', () => {
    expect(() => createEmbeddingModel({
      provider: 'anthropic', model: 'anything', maxTokens: 0, temperature: 0,
    })).toThrow('Anthropic does not support embedding models');
  });

  test('creates custom provider embedding model with baseUrl', () => {
    const model = createEmbeddingModel({
      provider: 'custom', model: 'my-embed', baseUrl: 'http://localhost:8080/v1', maxTokens: 0, temperature: 0,
    });
    expect(model).toBeDefined();
    expect((model as any).modelId).toBe('my-embed');
  });

  test('throws for unknown provider without baseUrl', () => {
    expect(() => createEmbeddingModel({
      provider: 'unknown', model: 'test', maxTokens: 0, temperature: 0,
    })).toThrow('Unknown provider "unknown"');
  });
});
