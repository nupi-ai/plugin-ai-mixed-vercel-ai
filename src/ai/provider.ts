import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import type { EmbeddingModel, LanguageModel } from 'ai';
import type { Config, TaskConfig } from '../config';

/** Error thrown when no task configuration exists for the requested event type. */
export class MissingTaskConfigError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly availableTasks: string[]
  ) {
    super(`No configuration for event_type '${eventType}'. Available tasks: ${availableTasks.join(', ')}`);
    this.name = 'MissingTaskConfigError';
  }
}

export function createModel(taskConfig: TaskConfig): LanguageModel {
  const provider = taskConfig.provider.toLowerCase();

  if (provider === 'anthropic') {
    if (taskConfig.apiKey) {
      return createAnthropic({ apiKey: taskConfig.apiKey })(taskConfig.model);
    }
    return anthropic(taskConfig.model);
  }

  if (provider === 'openai') {
    if (taskConfig.apiKey) {
      return createOpenAI({ apiKey: taskConfig.apiKey })(taskConfig.model);
    }
    return openai(taskConfig.model);
  }

  if (provider === 'google') {
    if (taskConfig.apiKey) {
      return createGoogleGenerativeAI({ apiKey: taskConfig.apiKey })(taskConfig.model);
    }
    return google(taskConfig.model);
  }

  if (provider === 'ollama') {
    const ollama = createOpenAI({
      baseURL: taskConfig.baseUrl || 'http://localhost:11434/v1',
      apiKey: taskConfig.apiKey || 'ollama',
    });
    return ollama(taskConfig.model);
  }

  // Any other provider - treat as OpenAI-compatible
  if (!taskConfig.baseUrl) {
    throw new Error(`Unknown provider "${provider}". For custom providers, set base_url.`);
  }

  const custom = createOpenAI({
    baseURL: taskConfig.baseUrl,
    apiKey: taskConfig.apiKey,
  });
  return custom(taskConfig.model);
}

export function createEmbeddingModel(taskConfig: TaskConfig): EmbeddingModel {
  const provider = taskConfig.provider.toLowerCase();

  if (provider === 'anthropic') {
    throw new Error('Anthropic does not support embedding models. Use OpenAI, Google, or Ollama.');
  }

  if (provider === 'openai') {
    if (taskConfig.apiKey) {
      return createOpenAI({ apiKey: taskConfig.apiKey }).embedding(taskConfig.model);
    }
    return openai.embedding(taskConfig.model);
  }

  if (provider === 'google') {
    if (taskConfig.apiKey) {
      return createGoogleGenerativeAI({ apiKey: taskConfig.apiKey }).textEmbeddingModel(taskConfig.model);
    }
    return google.textEmbeddingModel(taskConfig.model);
  }

  if (provider === 'ollama') {
    const ollama = createOpenAI({
      baseURL: taskConfig.baseUrl || 'http://localhost:11434/v1',
      apiKey: taskConfig.apiKey || 'ollama',
    });
    return ollama.embedding(taskConfig.model);
  }

  // Any other provider - treat as OpenAI-compatible
  if (!taskConfig.baseUrl) {
    throw new Error(`Unknown provider "${provider}". For custom providers, set base_url.`);
  }

  const custom = createOpenAI({
    baseURL: taskConfig.baseUrl,
    apiKey: taskConfig.apiKey,
  });
  return custom.embedding(taskConfig.model);
}

/** Result from ModelRouter containing both the model and its task config. */
export interface RouteResult {
  model: LanguageModel;
  taskConfig: TaskConfig;
}

/** ModelRouter provides lazy-cached model instances per event type. */
export class ModelRouter {
  private cache = new Map<string, RouteResult>();

  constructor(private config: Config) {}

  /** Resolves the event type key, applying empty→user_intent fallback. */
  resolveKey(eventType: string): string {
    return eventType || 'user_intent';
  }

  /** Returns the model and task config for the given event type. Caches instances. */
  getRoute(eventType: string): RouteResult {
    const key = this.resolveKey(eventType);

    const cached = this.cache.get(key);
    if (cached) return cached;

    const taskConfig = this.config.tasks[key];
    if (!taskConfig) {
      throw new MissingTaskConfigError(key, Object.keys(this.config.tasks));
    }

    const model = createModel(taskConfig);
    const result: RouteResult = { model, taskConfig };
    this.cache.set(key, result);
    console.log(`ModelRouter: created ${taskConfig.provider}/${taskConfig.model} for '${key}'`);
    return result;
  }
}
