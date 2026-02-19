import { embedMany } from 'ai';
import type * as grpc from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import type { Config } from '../config';
import type { EmbeddingRequest__Output } from '../proto/nupi/nap/v1/EmbeddingRequest';
import type { EmbeddingResponse } from '../proto/nupi/nap/v1/EmbeddingResponse';
import type { ResolveIntentRequest__Output } from '../proto/nupi/nap/v1/ResolveIntentRequest';
import type { ResolveIntentResponse } from '../proto/nupi/nap/v1/ResolveIntentResponse';
import type { ModelRouter } from '../ai/provider';
import { MissingTaskConfigError, createEmbeddingModel } from '../ai/provider';
import { resolveIntent } from '../ai/intent';

/** Maps proto EventType enum string to the config key (lowercase, no prefix). */
export function eventTypeToConfigKey(protoEventType: string): string {
  // Proto enum values arrive as 'EVENT_TYPE_USER_INTENT', 'EVENT_TYPE_SESSION_OUTPUT', etc.
  // Config keys are 'user_intent', 'session_output', etc.
  if (protoEventType.startsWith('EVENT_TYPE_')) {
    const stripped = protoEventType.slice('EVENT_TYPE_'.length).toLowerCase();
    // UNSPECIFIED → empty string (ModelRouter will default to user_intent)
    if (stripped === 'unspecified') return '';
    return stripped;
  }
  // Empty or unknown → empty string
  return '';
}

export function createIntentHandler(router: ModelRouter, config: Config) {
  return async (
    call: grpc.ServerUnaryCall<ResolveIntentRequest__Output, ResolveIntentResponse>,
    callback: grpc.sendUnaryData<ResolveIntentResponse>
  ) => {
    const request = call.request;
    const transcript = request.transcript?.substring(0, 100) || '';
    const eventType = eventTypeToConfigKey(request.eventType);
    const toolCount = request.availableTools?.length ?? 0;
    const historyLen = request.toolHistory?.length ?? 0;
    console.log(`ResolveIntent: promptId=${request.promptId}, eventType=${eventType || '(unspecified)'}, tools=${toolCount}, historyLen=${historyLen}, transcript="${transcript}${transcript.length >= 100 ? '...' : ''}"`);

    try {
      const { model, taskConfig } = router.getRoute(eventType);
      const response = await resolveIntent(model, request, config, taskConfig);

      const action = response.actions?.[0];
      const tcCount = response.toolCalls?.length ?? 0;
      console.log(`Response: action=${action?.type || 'none'}, confidence=${response.confidence}${tcCount > 0 ? `, toolCalls=${tcCount}` : ''}`);

      callback(null, response);
    } catch (err) {
      // Missing config → FAILED_PRECONDITION (not INTERNAL)
      if (err instanceof MissingTaskConfigError) {
        console.error(`ResolveIntent FAILED_PRECONDITION: ${err.message} (promptId=${request.promptId})`);
        callback({
          code: status.FAILED_PRECONDITION,
          message: err.message,
        });
        return;
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('ResolveIntent error:', message);
      callback({
        code: status.INTERNAL,
        message,
      });
    }
  };
}

export function createEmbeddingHandler(config: Config) {
  return async (
    call: grpc.ServerUnaryCall<EmbeddingRequest__Output, EmbeddingResponse>,
    callback: grpc.sendUnaryData<EmbeddingResponse>
  ) => {
    const request = call.request;
    const textCount = request.texts?.length ?? 0;
    console.log(`GenerateEmbeddings: texts=${textCount}`);

    // Empty texts → empty response
    if (textCount === 0) {
      console.log('Embeddings: 0 vectors (empty input)');
      callback(null, { embeddings: [], modelUsed: '', dimensions: 0, errorMessage: '' });
      return;
    }

    // Check embedding config
    const taskConfig = config.tasks['embedding'];
    if (!taskConfig) {
      const msg = `No embedding configuration found. Add an "embedding" entry to config.tasks with provider and model.`;
      console.log(`Embeddings: error: ${msg}`);
      callback(null, { embeddings: [], modelUsed: '', dimensions: 0, errorMessage: msg });
      return;
    }

    try {
      // Use request.model override if provided, otherwise config model
      const modelName = request.model || taskConfig.model;
      const effectiveConfig = request.model ? { ...taskConfig, model: modelName } : taskConfig;

      const embeddingModel = createEmbeddingModel(effectiveConfig);
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: request.texts,
      });

      const dimensions = embeddings.length > 0 ? embeddings[0].length : 0;
      console.log(`Embeddings: ${embeddings.length} vectors, ${dimensions}d, model=${modelName}`);

      callback(null, {
        embeddings: embeddings.map(values => ({ values })),
        modelUsed: modelName,
        dimensions,
        errorMessage: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown embedding error';
      console.log(`Embeddings: error: ${message}`);
      callback(null, { embeddings: [], modelUsed: '', dimensions: 0, errorMessage: message });
    }
  };
}
