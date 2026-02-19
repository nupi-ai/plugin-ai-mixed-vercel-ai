import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { LanguageModel, ModelMessage } from 'ai';
import type { Config, TaskConfig } from '../config';
import type { ResolveIntentRequest__Output } from '../proto/nupi/nap/v1/ResolveIntentRequest';
import type { ResolveIntentResponse } from '../proto/nupi/nap/v1/ResolveIntentResponse';
import type { ActionType } from '../proto/nupi/nap/v1/ActionType';
import type { ToolInteraction__Output } from '../proto/nupi/nap/v1/ToolInteraction';
import { resolveLanguageInstruction } from './language';
import { convertToolDefinitions } from './tools';

const IntentSchema = z.object({
  action: z.enum(['command', 'speak', 'clarify', 'noop']),
  sessionRef: z.string().nullable(),
  command: z.string().nullable(),
  text: z.string().nullable(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

function actionTypeToProto(action: string): ActionType {
  switch (action) {
    case 'command':
      return 'ACTION_TYPE_COMMAND';
    case 'speak':
      return 'ACTION_TYPE_SPEAK';
    case 'clarify':
      return 'ACTION_TYPE_CLARIFY';
    case 'noop':
    default:
      return 'ACTION_TYPE_NOOP';
  }
}

function buildFallbackSystemPrompt(request: ResolveIntentRequest__Output): string {
  const sessions = request.availableSessions
    .map(s => `- ${s.id}: ${s.command} in ${s.workDir} (${s.status})`)
    .join('\n');

  return `You are a voice assistant for a terminal/IDE environment.
Your job is to interpret user voice commands and decide what action to take.

Available sessions:
${sessions || 'No active sessions'}

Current session: ${request.sessionId || 'none'}
Current tool: ${request.currentTool || 'unknown'}

You must respond with one of these actions:
- command: Execute a shell command in a session
- speak: Speak a response to the user (no execution)
- clarify: Ask the user for more information
- noop: No action needed

Always include reasoning and confidence (0-1) in your response.`;
}

/**
 * Builds the messages array for generateText, incorporating tool history
 * from previous iterations of the multi-turn tool-use loop.
 */
export function buildMessages(
  systemPrompt: string,
  userPrompt: string,
  toolHistory: ToolInteraction__Output[]
): ModelMessage[] {
  const messages: ModelMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  for (const interaction of toolHistory) {
    if (!interaction.call || !interaction.result) continue;

    try {
      const input = JSON.parse(interaction.call.argumentsJson || '{}');
      let resultValue = JSON.parse(interaction.result.resultJson || '{}');
      if (interaction.result.isError) {
        resultValue = { error: true, message: resultValue };
      }

      messages.push({
        role: 'assistant',
        content: [{
          type: 'tool-call',
          toolCallId: interaction.call.callId,
          toolName: interaction.call.toolName,
          input,
        }],
      });
      messages.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: interaction.call.callId,
          toolName: interaction.call.toolName,
          output: { type: 'json', value: resultValue },
        }],
      });
    } catch (err) {
      console.warn(`[AI Adapter] Skipping malformed tool interaction '${interaction.call.callId}':`, err);
    }
  }

  return messages;
}

export async function resolveIntent(
  model: LanguageModel,
  request: ResolveIntentRequest__Output,
  config: Config,
  taskConfig: TaskConfig
): Promise<ResolveIntentResponse> {
  let systemPrompt = request.systemPrompt || buildFallbackSystemPrompt(request);
  const userPrompt = request.userPrompt || request.transcript;

  const langInstruction = resolveLanguageInstruction(config.language, request.metadata);
  if (langInstruction) {
    systemPrompt = `${systemPrompt}\n\n${langInstruction}`;
  }

  try {
    // Convert proto tool definitions to Vercel AI SDK format (without execute callbacks)
    const tools = convertToolDefinitions(request.availableTools);
    const hasTools = Object.keys(tools).length > 0;
    const hasHistory = request.toolHistory.length > 0;

    const result = await generateText({
      model,
      output: Output.object({ schema: IntentSchema }),
      ...(hasTools ? { tools } : {}),
      ...(hasHistory
        ? { messages: buildMessages(systemPrompt, userPrompt, request.toolHistory) }
        : { system: systemPrompt, prompt: userPrompt }
      ),
      maxOutputTokens: taskConfig.maxTokens,
      temperature: taskConfig.temperature,
    });

    // Check for tool calls — AI wants to invoke tools
    const toolCalls = result.steps?.flatMap(s => s.toolCalls ?? []) ?? [];
    if (toolCalls.length > 0) {
      return {
        promptId: request.promptId,
        actions: [{
          type: 'ACTION_TYPE_TOOL_USE',
          sessionRef: request.sessionId,
          command: '',
          text: '',
          metadata: {},
        }],
        reasoning: '',
        confidence: 1.0,
        metadata: {},
        errorMessage: '',
        toolCalls: toolCalls.map(tc => ({
          callId: tc.toolCallId,
          toolName: tc.toolName,
          argumentsJson: JSON.stringify(tc.input),
        })),
      };
    }

    // Final response — parse structured output
    const output = result.output;
    if (output) {
      return {
        promptId: request.promptId,
        actions: [{
          type: actionTypeToProto(output.action),
          sessionRef: output.sessionRef ?? request.sessionId,
          command: output.command ?? '',
          text: output.text ?? '',
          metadata: {},
        }],
        reasoning: output.reasoning,
        confidence: output.confidence,
        metadata: {},
        errorMessage: '',
        toolCalls: [],
      };
    }

    // Fallback: no tool calls and no structured output
    return {
      promptId: request.promptId,
      actions: [{
        type: 'ACTION_TYPE_SPEAK',
        sessionRef: request.sessionId,
        command: '',
        text: result.text || 'I could not determine the appropriate action.',
        metadata: {},
      }],
      reasoning: 'Fallback: no structured output received',
      confidence: 0.3,
      metadata: {},
      errorMessage: '',
      toolCalls: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI generation error:', message);

    return {
      promptId: request.promptId,
      actions: [],
      reasoning: '',
      confidence: 0,
      metadata: {},
      errorMessage: message,
      toolCalls: [],
    };
  }
}
