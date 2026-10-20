/**
 * Inflated free-lane multimodal usage must not outlive the advertised window.
 *
 * Run: node scripts/usage-sanitize-test.mjs
 */
import assert from 'node:assert/strict'
import { mapUsage, sanitizeUsage } from '../src/stream.js'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const window = 256_000

// Honest short turn stays intact.
{
  const mapped = mapUsage({
    prompt_tokens: 37_007,
    completion_tokens: 191,
    prompt_tokens_details: { cached_tokens: 36_627 },
  })
  const trusted = sanitizeUsage(mapped, window)
  check(
    'honest usage under the window is unchanged',
    trusted === mapped
      && trusted.inputTokens === 380
      && trusted.cacheReadTokens === 36_627
      && trusted.totalTokens === 37_198,
    JSON.stringify(trusted),
  )
}

// Observed kilo-auto/free stamp after two read_image results (~619k > 256k).
{
  const mapped = mapUsage({
    prompt_tokens: 618_820,
    completion_tokens: 717,
    prompt_tokens_details: { cached_tokens: 62_713 },
    completion_tokens_details: { reasoning_tokens: 637 },
  })
  assert.equal(mapped.totalTokens, 619_537)
  const trusted = sanitizeUsage(mapped, window)
  check(
    'inflated multimodal total drops prompt pressure (keeps output/reasoning)',
    trusted !== undefined
      && trusted.inputTokens === 0
      && !('cacheReadTokens' in trusted)
      && !('totalTokens' in trusted)
      && trusted.outputTokens === 717
      && trusted.reasoningTokens === 637,
    JSON.stringify(trusted),
  )
}

check(
  'missing / non-positive window is a no-op',
  sanitizeUsage({ inputTokens: 9, outputTokens: 1, totalTokens: 10 }, 0)?.totalTokens === 10
    && sanitizeUsage({ inputTokens: 9, outputTokens: 1, totalTokens: 10 }, undefined)?.totalTokens === 10,
)

check(
  'output-only inflated sample with zero output collapses to undefined',
  sanitizeUsage({ inputTokens: 500_000, outputTokens: 0, totalTokens: 500_000 }, window) === undefined,
)

console.log(failed === 0
  ? '\nusage-sanitize: inflated multimodal stamps are rejected'
  : `\nusage-sanitize: ${failed} failure(s)`)
process.exit(failed === 0 ? 0 : 1)
