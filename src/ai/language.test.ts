import { describe, expect, test } from 'bun:test';
import { resolveLanguageInstruction } from './language';

describe('resolveLanguageInstruction', () => {
  test('client mode with metadata returns language instruction', () => {
    const meta = { 'nupi.lang.english': 'Polish', 'nupi.lang.iso1': 'pl' };
    expect(resolveLanguageInstruction('client', meta)).toBe(
      'Always respond in Polish.'
    );
  });

  test('client mode without metadata returns empty string', () => {
    expect(resolveLanguageInstruction('client', undefined)).toBe('');
    expect(resolveLanguageInstruction('client', null)).toBe('');
  });

  test('client mode with empty metadata returns empty string', () => {
    expect(resolveLanguageInstruction('client', {})).toBe('');
  });

  test('client mode with empty english name returns empty string', () => {
    const meta = { 'nupi.lang.english': '' };
    expect(resolveLanguageInstruction('client', meta)).toBe('');
  });

  test('auto mode with metadata returns detect instruction', () => {
    const meta = { 'nupi.lang.english': 'Polish', 'nupi.lang.iso1': 'pl' };
    expect(resolveLanguageInstruction('auto', meta)).toBe(
      "Detect the language of the user's message and respond in the same language."
    );
  });

  test('auto mode without metadata returns detect instruction', () => {
    expect(resolveLanguageInstruction('auto', undefined)).toBe(
      "Detect the language of the user's message and respond in the same language."
    );
  });

  test('specific code with metadata ignores metadata', () => {
    const meta = { 'nupi.lang.english': 'Polish', 'nupi.lang.iso1': 'pl' };
    expect(resolveLanguageInstruction('en', meta)).toBe(
      'Always respond in English regardless of the input language.'
    );
  });

  test('specific code without metadata uses code name', () => {
    expect(resolveLanguageInstruction('de', undefined)).toBe(
      'Always respond in German regardless of the input language.'
    );
  });

  test('specific code resolves common languages', () => {
    expect(resolveLanguageInstruction('fr', {})).toBe(
      'Always respond in French regardless of the input language.'
    );
    expect(resolveLanguageInstruction('ja', {})).toBe(
      'Always respond in Japanese regardless of the input language.'
    );
    expect(resolveLanguageInstruction('es', {})).toBe(
      'Always respond in Spanish regardless of the input language.'
    );
  });

  test('unknown specific code uses uppercase code', () => {
    expect(resolveLanguageInstruction('xx', {})).toBe(
      'Always respond in XX regardless of the input language.'
    );
  });

  test('client mode with whitespace english name trims it', () => {
    const meta = { 'nupi.lang.english': '  Polish  ' };
    expect(resolveLanguageInstruction('client', meta)).toBe(
      'Always respond in Polish.'
    );
  });

  test('client mode with whitespace-only english name returns empty', () => {
    const meta = { 'nupi.lang.english': '   ' };
    expect(resolveLanguageInstruction('client', meta)).toBe('');
  });
});
