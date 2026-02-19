import { describe, expect, test } from 'bun:test';
import { eventTypeToConfigKey } from './handlers';

describe('eventTypeToConfigKey', () => {
  test('maps known proto event types to config keys', () => {
    expect(eventTypeToConfigKey('EVENT_TYPE_USER_INTENT')).toBe('user_intent');
    expect(eventTypeToConfigKey('EVENT_TYPE_SESSION_OUTPUT')).toBe('session_output');
    expect(eventTypeToConfigKey('EVENT_TYPE_HISTORY_SUMMARY')).toBe('history_summary');
    expect(eventTypeToConfigKey('EVENT_TYPE_CLARIFICATION')).toBe('clarification');
    expect(eventTypeToConfigKey('EVENT_TYPE_MEMORY_FLUSH')).toBe('memory_flush');
    expect(eventTypeToConfigKey('EVENT_TYPE_SCHEDULED_TASK')).toBe('scheduled_task');
    expect(eventTypeToConfigKey('EVENT_TYPE_SESSION_SLUG')).toBe('session_slug');
    expect(eventTypeToConfigKey('EVENT_TYPE_ONBOARDING')).toBe('onboarding');
  });

  test('maps UNSPECIFIED to empty string', () => {
    expect(eventTypeToConfigKey('EVENT_TYPE_UNSPECIFIED')).toBe('');
  });

  test('maps empty string to empty string', () => {
    expect(eventTypeToConfigKey('')).toBe('');
  });

  test('maps unknown values to empty string', () => {
    expect(eventTypeToConfigKey('SOMETHING_RANDOM')).toBe('');
  });
});
