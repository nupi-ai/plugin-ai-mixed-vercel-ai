import { describe, expect, test } from 'bun:test';
import { buildMessages } from './intent';
import type { ToolInteraction__Output } from '../proto/nupi/nap/v1/ToolInteraction';

function makeInteraction(
  callId: string,
  toolName: string,
  argsJson: string,
  resultJson: string,
  isError = false
): ToolInteraction__Output {
  return {
    call: { callId, toolName, argumentsJson: argsJson },
    result: { callId, resultJson, isError },
  };
}

describe('buildMessages', () => {
  test('returns system+user messages for empty tool history', () => {
    const messages = buildMessages('system prompt', 'user input', []);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(messages[1]).toEqual({ role: 'user', content: 'user input' });
  });

  test('builds messages with single tool interaction', () => {
    const history: ToolInteraction__Output[] = [
      makeInteraction(
        'call-1', 'memory_search',
        '{"query":"test"}',
        '{"results":["found"]}'
      ),
    ];

    const messages = buildMessages('sys', 'user', history);
    expect(messages).toHaveLength(4); // system + user + assistant(tool-call) + tool(tool-result)

    // Assistant tool call message
    expect(messages[2].role).toBe('assistant');
    const assistantContent = messages[2].content as any[];
    expect(assistantContent[0].type).toBe('tool-call');
    expect(assistantContent[0].toolCallId).toBe('call-1');
    expect(assistantContent[0].toolName).toBe('memory_search');
    expect(assistantContent[0].input).toEqual({ query: 'test' });

    // Tool result message
    expect(messages[3].role).toBe('tool');
    const toolContent = messages[3].content as any[];
    expect(toolContent[0].type).toBe('tool-result');
    expect(toolContent[0].toolCallId).toBe('call-1');
    expect(toolContent[0].output).toEqual({ type: 'json', value: { results: ['found'] } });
  });

  test('builds messages with multiple tool interactions', () => {
    const history: ToolInteraction__Output[] = [
      makeInteraction('c1', 'memory_search', '{"query":"a"}', '{"r":"1"}'),
      makeInteraction('c2', 'memory_write', '{"content":"b"}', '{"ok":true}'),
    ];

    const messages = buildMessages('sys', 'user', history);
    expect(messages).toHaveLength(6); // 2 base + 2*2 tool interactions

    // First interaction
    expect((messages[2].content as any[])[0].toolName).toBe('memory_search');
    expect((messages[3].content as any[])[0].toolCallId).toBe('c1');

    // Second interaction
    expect((messages[4].content as any[])[0].toolName).toBe('memory_write');
    expect((messages[5].content as any[])[0].toolCallId).toBe('c2');
  });

  test('skips interactions with null call or result', () => {
    const history: ToolInteraction__Output[] = [
      { call: null, result: null },
      makeInteraction('c1', 'memory_search', '{"q":"x"}', '{"r":"y"}'),
      { call: { callId: 'c2', toolName: 'test', argumentsJson: '{}' }, result: null },
    ];

    const messages = buildMessages('sys', 'user', history);
    // Only the valid interaction should produce messages
    expect(messages).toHaveLength(4); // 2 base + 1*2
  });

  test('handles empty argumentsJson and resultJson gracefully', () => {
    const history: ToolInteraction__Output[] = [
      makeInteraction('c1', 'tool', '', ''),
    ];

    const messages = buildMessages('sys', 'user', history);
    expect(messages).toHaveLength(4);
    // Empty strings default to {}
    expect((messages[2].content as any[])[0].input).toEqual({});
    expect((messages[3].content as any[])[0].output).toEqual({ type: 'json', value: {} });
  });

  test('wraps isError tool results with error context', () => {
    const history: ToolInteraction__Output[] = [
      makeInteraction('c1', 'memory_search', '{"query":"test"}', '{"message":"not found"}', true),
    ];

    const messages = buildMessages('sys', 'user', history);
    expect(messages).toHaveLength(4);
    const toolContent = messages[3].content as any[];
    expect(toolContent[0].output).toEqual({
      type: 'json',
      value: { error: true, message: { message: 'not found' } },
    });
  });

  test('skips interactions with malformed argumentsJson', () => {
    const history: ToolInteraction__Output[] = [
      makeInteraction('c1', 'bad_tool', 'not valid json', '{}'),
      makeInteraction('c2', 'good_tool', '{"q":"test"}', '{"r":"ok"}'),
    ];

    const messages = buildMessages('sys', 'user', history);
    // Only the valid interaction should produce messages
    expect(messages).toHaveLength(4); // 2 base + 1*2
    expect((messages[2].content as any[])[0].toolCallId).toBe('c2');
  });

  test('skips interactions with malformed resultJson', () => {
    const history: ToolInteraction__Output[] = [
      makeInteraction('c1', 'bad_tool', '{}', 'not valid json'),
      makeInteraction('c2', 'good_tool', '{"q":"test"}', '{"r":"ok"}'),
    ];

    const messages = buildMessages('sys', 'user', history);
    expect(messages).toHaveLength(4);
    expect((messages[2].content as any[])[0].toolCallId).toBe('c2');
  });
});
