/**
 * Modular AI service registry.
 *
 * Swap providers via AI_PROVIDER (see .env.example) without touching the rest
 * of the application. Both providers implement:
 *   - extractConstructs({ pages, title, researchQuestion }) -> candidate items
 *   - similarity(textA, textB) -> number in [0, 1]
 * All candidates pass through the same verification step, so switching the
 * provider can never introduce invented evidence.
 */
import { env } from '../../config/env.js';
import { diceSimilarity } from '../../utils/text.js';
import { extractWithRules } from './ruleProvider.js';
import { createHfProvider } from './hfProvider.js';

export const ruleProvider = {
  name: 'rule',
  extractConstructs: (input) => Promise.resolve(extractWithRules(input)),
  similarity: async (a, b) => diceSimilarity(a, b),
};

let cached = null;

export function getProvider() {
  if (cached) return cached;
  if (env.aiProvider === 'hf') {
    if (!env.hfToken) {
      // eslint-disable-next-line no-console
      console.warn('[ai] AI_PROVIDER=hf but HF_TOKEN is missing; using local rule-based provider.');
      cached = ruleProvider;
    } else {
      cached = createHfProvider(ruleProvider);
      // eslint-disable-next-line no-console
      console.log(`[ai] Provider: Hugging Face (${env.hfModel}) with local fallback.`);
    }
  } else {
    cached = ruleProvider;
    // eslint-disable-next-line no-console
    console.log('[ai] Provider: local rule-based extraction (no external calls).');
  }
  return cached;
}
