# Nupi AI Mixed (Vercel AI SDK)

Universal AI adapter for the Nupi platform, supporting multiple providers via the Vercel AI SDK. Implements the `AIService` gRPC contract from `nap.nupi.ai/v1alpha1`.

## Supported Providers

- OpenAI (GPT-4o, GPT-4o-mini, etc.)
- Anthropic (Claude)
- Google (Gemini)
- Ollama (local models)
- Any OpenAI-compatible endpoint

## Quick Start

```bash
bun install
bun run src/index.ts
```

The adapter is launched automatically by the Nupi daemon when configured as the AI slot adapter.

## Configuration

Options are set via the Nupi adapter configuration system:

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | `openai` | AI provider name |
| `model` | `gpt-4o-mini` | Model identifier |
| `api_key` | — | API key for the provider (not needed for Ollama) |
| `base_url` | — | Custom base URL (for openai-compatible or Ollama) |
| `max_tokens` | `1024` | Maximum tokens in response |
| `temperature` | `0.7` | Sampling temperature (0.0-2.0) |

## Repository Structure

- `src/` — TypeScript source (gRPC server, provider adapters)
- `proto/` — Downloaded protobuf definitions (fetched on-demand)
- `scripts/` — Build and proto fetch scripts
- `plugin.yaml` — NAP manifest consumed by the adapter runtime

## License

See [LICENSE](LICENSE).
