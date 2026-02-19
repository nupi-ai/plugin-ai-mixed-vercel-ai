import { describe, expect, test } from 'bun:test';
import { convertToolDefinitions } from './tools';
import type { ToolDefinition__Output } from '../proto/nupi/nap/v1/ToolDefinition';

function makeDef(name: string, description: string, parametersJson: string): ToolDefinition__Output {
  return { name, description, parametersJson };
}

describe('convertToolDefinitions', () => {
  test('returns empty object for empty array', () => {
    expect(convertToolDefinitions([])).toEqual({});
  });

  test('returns empty object for null-like input', () => {
    expect(convertToolDefinitions(null as any)).toEqual({});
    expect(convertToolDefinitions(undefined as any)).toEqual({});
  });

  test('converts valid tool definitions', () => {
    const defs: ToolDefinition__Output[] = [
      makeDef('memory_search', 'Search long-term memory', JSON.stringify({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          scope: { type: 'string', enum: ['project', 'global', 'all'], default: 'project' },
          max_results: { type: 'integer', default: 5 },
        },
        required: ['query'],
      })),
    ];

    const tools = convertToolDefinitions(defs);
    expect(Object.keys(tools)).toEqual(['memory_search']);
    expect(tools.memory_search).toBeDefined();
    // Tool should NOT have execute callback (intent router handles execution)
    expect((tools.memory_search as any).execute).toBeUndefined();
  });

  test('converts multiple tool definitions', () => {
    const defs: ToolDefinition__Output[] = [
      makeDef('memory_search', 'Search memory', '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}'),
      makeDef('memory_write', 'Write to memory', '{"type":"object","properties":{"content":{"type":"string"}},"required":["content"]}'),
    ];

    const tools = convertToolDefinitions(defs);
    expect(Object.keys(tools)).toEqual(['memory_search', 'memory_write']);
  });

  test('skips tools with empty name', () => {
    const defs: ToolDefinition__Output[] = [
      makeDef('', 'No name tool', '{"type":"object"}'),
      makeDef('valid_tool', 'Valid tool', '{"type":"object"}'),
    ];

    const tools = convertToolDefinitions(defs);
    expect(Object.keys(tools)).toEqual(['valid_tool']);
  });

  test('skips tools with malformed parametersJson and logs warning', () => {
    const defs: ToolDefinition__Output[] = [
      makeDef('bad_tool', 'Bad params', 'not valid json'),
      makeDef('good_tool', 'Good tool', '{"type":"object"}'),
    ];

    const tools = convertToolDefinitions(defs);
    expect(Object.keys(tools)).toEqual(['good_tool']);
  });

  test('handles empty parametersJson by defaulting to object schema', () => {
    const defs: ToolDefinition__Output[] = [
      makeDef('simple_tool', 'Simple', ''),
    ];

    const tools = convertToolDefinitions(defs);
    expect(Object.keys(tools)).toEqual(['simple_tool']);
  });
});
