// Global LLM settings
//
// Model names live in config
// Prompts are versioned files in worker/prompts/. To change a prompt, add a new .md file and point `prompt` at it
import lookupV1 from "../prompts/lookup.v1.md";

export interface Prompt {
  version: string;
  text: string;
}

export interface LookupLlmConfig {
  prompt: Prompt;
  /** Low temperature: stable, dictionary-like answers. */
  temperature: number;
  /** Room for the JSON reply; a lookup reply is ~100 tokens. */
  maxTokens: number;
  /** Total model calls per lookup: the first call plus retries on invalid output. */
  maxAttempts: number;
  /** Sent as chat_template_kwargs. Qwen 3.8 ignores "/no_think"; only enable_thinking: false turns thinking off. */
  chatTemplateKwargs: Record<string, unknown>;
}

export const LOOKUP_LLM: LookupLlmConfig = {
  prompt: { version: "lookup.v1", text: lookupV1 },
  temperature: 0.2,
  maxTokens: 400,
  maxAttempts: 2,
  chatTemplateKwargs: { enable_thinking: false },
};
