import type * as grpc from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import type { Config } from '../config';
import type { ResolveIntentRequest__Output } from '../proto/nupi/nap/v1/ResolveIntentRequest';
import type { ResolveIntentResponse } from '../proto/nupi/nap/v1/ResolveIntentResponse';
import { createProvider } from '../ai/provider';
import { resolveIntent } from '../ai/intent';

export function createIntentHandler(config: Config) {
  const model = createProvider(config);
  console.log(`AI provider initialized: ${config.provider}/${config.model}`);

  return async (
    call: grpc.ServerUnaryCall<ResolveIntentRequest__Output, ResolveIntentResponse>,
    callback: grpc.sendUnaryData<ResolveIntentResponse>
  ) => {
    const request = call.request;
    const transcript = request.transcript?.substring(0, 100) || '';
    console.log(`ResolveIntent: promptId=${request.promptId}, transcript="${transcript}${transcript.length >= 100 ? '...' : ''}"`);

    try {
      const response = await resolveIntent(model, request, config);

      const action = response.actions?.[0];
      console.log(`Response: action=${action?.type || 'none'}, confidence=${response.confidence}`);

      callback(null, response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('ResolveIntent error:', message);

      callback({
        code: status.INTERNAL,
        message,
      });
    }
  };
}
