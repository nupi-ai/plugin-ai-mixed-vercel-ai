import { generateObject } from 'ai';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import type { Config, TaskConfig } from '../config';
import type { ResolveIntentRequest__Output } from '../proto/nupi/nap/v1/ResolveIntentRequest';
import type { ResolveIntentResponse } from '../proto/nupi/nap/v1/ResolveIntentResponse';
import type { ActionType } from '../proto/nupi/nap/v1/ActionType';
import { resolveLanguageInstruction } from './language';

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

export async function resolveIntent(
  model: LanguageModel,
  request: ResolveIntentRequest__Output,
  config: Config,
  taskConfig: TaskConfig
): Promise<ResolveIntentResponse> {
  // Use pre-built prompts from Nupi's Prompts Engine if available
  let systemPrompt = request.systemPrompt || buildFallbackSystemPrompt(request);
  const userPrompt = request.userPrompt || request.transcript;

  // Append language instruction based on config mode and request metadata.
  const langInstruction = resolveLanguageInstruction(config.language, request.metadata);
  if (langInstruction) {
    systemPrompt = `${systemPrompt}\n\n${langInstruction}`;
  }

  try {
    const { object } = await generateObject({
      model,
      schema: IntentSchema,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: taskConfig.maxTokens,
      temperature: taskConfig.temperature,
    });

    return {
      promptId: request.promptId,
      actions: [{
        type: actionTypeToProto(object.action),
        sessionRef: object.sessionRef ?? request.sessionId,
        command: object.command ?? '',
        text: object.text ?? '',
        metadata: {},
      }],
      reasoning: object.reasoning,
      confidence: object.confidence,
      metadata: {},
      errorMessage: '',
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
    };
  }
}
