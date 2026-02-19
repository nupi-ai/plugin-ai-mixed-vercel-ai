import { describe, expect, test, mock } from 'bun:test';
import { eventTypeToConfigKey, createEmbeddingHandler } from './handlers';
import type { Config } from '../config';

// Mock embedMany from 'ai' for happy-path handler tests
mock.module('ai', () => ({
  embedMany: async ({ values }: { values: string[] }) => ({
    embeddings: values.map(() => [0.1, 0.2, 0.3]),
    usage: { tokens: values.length * 5 },
  }),
}));

describe('eventTypeToConfigKey', () => {
  test('maps known proto event types to config keys', () => {
    expect(eventTypeToConfigKey('EVENT_TYPE_USER_INTENT')).toBe('user_intent');
    expect(eventTypeToConfigKey('EVENT_TYPE_SESSION_OUTPUT')).toBe('session_output');
    expect(eventTypeToConfigKey('EVENT_TYPE_HISTORY_SUMMARY')).toBe('history_summary');
    expect(eventTypeToConfigKey('EVENT_TYPE_CLARIFICATION')).toBe('clarification');
    expect(eventTypeToConfigKey('EVENT_TYPE_MEMORY_FLUSH')).toBe('memory_flush');
    expect(eventTypeToConfigKey('EVENT_TYPE_SCHEDULED_TASK')).toBe('scheduled_task');
    expect(eventTypeToConfigKey('EVENT_TYPE_SESSION_SLUG')).toBe('session_slug');
    expect(eventTypeToConfigKey('EVENT_TYPE_ONBOARDING')).toBe('onboarding');
  });

  test('maps UNSPECIFIED to empty string', () => {
    expect(eventTypeToConfigKey('EVENT_TYPE_UNSPECIFIED')).toBe('');
  });

  test('maps empty string to empty string', () => {
    expect(eventTypeToConfigKey('')).toBe('');
  });

  test('maps unknown values to empty string', () => {
    expect(eventTypeToConfigKey('SOMETHING_RANDOM')).toBe('');
  });
});

describe('createEmbeddingHandler', () => {
  function makeConfig(withEmbedding: boolean): Config {
    const tasks: Config['tasks'] = {
      user_intent: { provider: 'openai', model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.7 },
    };
    if (withEmbedding) {
      tasks['embedding'] = { provider: 'openai', model: 'text-embedding-3-small', maxTokens: 0, temperature: 0 };
    }
    return { tasks, language: 'client' };
  }

  function makeCall(texts: string[], model = ''): any {
    return { request: { texts, model, metadata: {} } };
  }

  test('returns empty embeddings for empty texts array', async () => {
    const handler = createEmbeddingHandler(makeConfig(true));
    const result = await new Promise<any>((resolve) => {
      handler(makeCall([]), (_err: any, response: any) => resolve(response));
    });
    expect(result.embeddings).toEqual([]);
    expect(result.errorMessage).toBe('');
    expect(result.dimensions).toBe(0);
  });

  test('returns errorMessage when embedding config is missing', async () => {
    const handler = createEmbeddingHandler(makeConfig(false));
    const result = await new Promise<any>((resolve) => {
      handler(makeCall(['test']), (_err: any, response: any) => resolve(response));
    });
    expect(result.embeddings).toEqual([]);
    expect(result.errorMessage).toContain('No embedding configuration found');
    expect(result.dimensions).toBe(0);
  });

  test('returns errorMessage (not gRPC error) on provider failure', async () => {
    // Use a config with anthropic (which throws for embeddings)
    const config: Config = {
      tasks: {
        embedding: { provider: 'anthropic', model: 'anything', maxTokens: 0, temperature: 0 },
      },
      language: 'client',
    };
    const handler = createEmbeddingHandler(config);
    const result = await new Promise<any>((resolve) => {
      handler(makeCall(['test text']), (_err: any, response: any) => resolve(response));
    });
    expect(result.embeddings).toEqual([]);
    expect(result.errorMessage).toContain('Anthropic does not support embedding models');
    expect(result.dimensions).toBe(0);
  });

  test('maps embedMany results to proto EmbeddingVector format', async () => {
    const handler = createEmbeddingHandler(makeConfig(true));
    const result = await new Promise<any>((resolve) => {
      handler(makeCall(['hello', 'world']), (_err: any, response: any) => resolve(response));
    });
    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0].values).toEqual([0.1, 0.2, 0.3]);
    expect(result.embeddings[1].values).toEqual([0.1, 0.2, 0.3]);
    expect(result.modelUsed).toBe('text-embedding-3-small');
    expect(result.dimensions).toBe(3);
    expect(result.errorMessage).toBe('');
  });

  test('uses request.model override when provided', async () => {
    const handler = createEmbeddingHandler(makeConfig(true));
    const result = await new Promise<any>((resolve) => {
      handler(makeCall(['test'], 'text-embedding-3-large'), (_err: any, response: any) => resolve(response));
    });
    expect(result.modelUsed).toBe('text-embedding-3-large');
    expect(result.embeddings).toHaveLength(1);
    expect(result.errorMessage).toBe('');
  });
});
