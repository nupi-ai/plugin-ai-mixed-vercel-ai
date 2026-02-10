export interface Config {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

export function loadConfig(): Config {
  const raw = process.env.NUPI_ADAPTER_CONFIG;
  if (!raw) {
    // For standalone testing, use defaults
    console.warn('NUPI_ADAPTER_CONFIG not set, using defaults');
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: undefined,
      baseUrl: undefined,
      maxTokens: 1024,
      temperature: 0.7,
    };
  }

  const json = JSON.parse(raw);
  return {
    provider: json.provider || 'openai',
    model: json.model || 'gpt-4o-mini',
    apiKey: json.api_key,
    baseUrl: json.base_url,
    maxTokens: json.max_tokens || 1024,
    temperature: json.temperature || 0.7,
  };
}
