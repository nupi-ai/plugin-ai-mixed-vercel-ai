import type * as grpc from '@grpc/grpc-js';
import { status } from '@grpc/grpc-js';
import type { Config } from '../config';
import type { ResolveIntentRequest__Output } from '../proto/nupi/nap/v1/ResolveIntentRequest';
import type { ResolveIntentResponse } from '../proto/nupi/nap/v1/ResolveIntentResponse';
import type { ModelRouter } from '../ai/provider';
import { MissingTaskConfigError } from '../ai/provider';
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
    console.log(`ResolveIntent: promptId=${request.promptId}, eventType=${eventType || '(unspecified)'}, transcript="${transcript}${transcript.length >= 100 ? '...' : ''}"`);

    try {
      const { model, taskConfig } = router.getRoute(eventType);
      const response = await resolveIntent(model, request, config, taskConfig);

      const action = response.actions?.[0];
      console.log(`Response: action=${action?.type || 'none'}, confidence=${response.confidence}`);

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
