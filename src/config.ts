/** Per-task model configuration. Each task has a complete, self-contained config. */
export interface TaskConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

/** Top-level plugin configuration with per-event-type task routing. */
export interface Config {
  tasks: Record<string, TaskConfig>;
  language: string;
}

export function loadConfig(): Config {
  const raw = process.env.NUPI_ADAPTER_CONFIG;
  if (!raw) {
    console.warn('NUPI_ADAPTER_CONFIG not set, using defaults');
    return {
      tasks: {
        user_intent: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          maxTokens: 1024,
          temperature: 0.7,
        },
      },
      language: 'client',
    };
  }

  const json = JSON.parse(raw);

  // Parse tasks map
  const tasks: Record<string, TaskConfig> = {};
  const rawTasks = json.tasks;
  if (!rawTasks || typeof rawTasks !== 'object' || Array.isArray(rawTasks)) {
    throw new Error('AI adapter config: "tasks" map is required');
  }

  for (const [eventType, rawTask] of Object.entries(rawTasks)) {
    const t = rawTask as Record<string, unknown>;
    if (!t.provider || !t.model) {
      throw new Error(
        `AI adapter config: task "${eventType}" requires "provider" and "model"`
      );
    }
    tasks[eventType] = {
      provider: String(t.provider),
      model: String(t.model),
      apiKey: t.api_key ? String(t.api_key) : undefined,
      baseUrl: t.base_url ? String(t.base_url) : undefined,
      maxTokens: t.max_tokens != null ? Number(t.max_tokens) : 1024,
      temperature: t.temperature != null ? Number(t.temperature) : 0.7,
    };
  }

  const configuredTasks = Object.keys(tasks).join(', ');
  console.log(`AI adapter configured tasks: ${configuredTasks}`);

  return {
    tasks,
    language: (json.language || 'client').trim().toLowerCase(),
  };
}
