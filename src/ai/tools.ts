import { tool, jsonSchema } from 'ai';
import type { Tool } from 'ai';
import type { ToolDefinition__Output } from '../proto/nupi/nap/v1/ToolDefinition';

/**
 * Converts proto ToolDefinition array to Vercel AI SDK tool definitions.
 * Uses jsonSchema() for direct JSON Schema pass-through (no Zod conversion needed).
 * Tools are defined WITHOUT execute callback — intent router handles execution.
 */
export function convertToolDefinitions(
  defs: ToolDefinition__Output[]
): Record<string, Tool> {
  if (!defs || defs.length === 0) return {};

  const tools: Record<string, Tool> = {};

  for (const def of defs) {
    if (!def.name) continue;

    try {
      const schema = JSON.parse(def.parametersJson || '{"type":"object"}');
      tools[def.name] = tool({
        description: def.description || '',
        inputSchema: jsonSchema(schema),
        // execute OMITTED — intent router handles tool execution via ToolRegistry
      });
    } catch (err) {
      console.warn(`[AI Adapter] Skipping tool '${def.name}': invalid parametersJson`, err);
    }
  }

  return tools;
}
