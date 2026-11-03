/**
 * trae 上游诊断事件（metadata / timing_cost）解码回归测试。
 *
 * 背景：上游用 `metadata.prompt_cache_pool_record` 唯一地声明「这次请求有没有
 * 分配前缀缓存池」。本插件原先没有解析这两个事件，把它们静默丢弃 —— 于是
 * 「缓存恒 0」无法与「插件丢字段」区分（用户反复报障「还是没有缓存」）。
 *
 * 本测试锁死三件事：
 *   1. `metadata` 的 `prompt_cache_pool_record` 被解码出来；
 *   2. `null` 与「字段不存在」**必须区分**（前者=上游明确没给池）；
 *   3. `timing_cost` 的管线名与作答模型被解码出来。
 *
 * 纯离线，不发任何请求。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const sourceMode = process.argv.includes('--source')
const sourceRoot = new URL('../vendor/channel-pack/src/', import.meta.url).href
const ts = sourceMode ? (await import('typescript')).default : undefined

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    // 源码里一律写 `./x.js`（编译后形态），source 模式下要映射回 `.ts`。
    if (sourceMode && context.parentURL?.startsWith(sourceRoot) && specifier.endsWith('.js')) {
      const url = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL).href
      if (fs.existsSync(fileURLToPath(url))) return { url, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (sourceMode && url.startsWith(sourceRoot) && url.endsWith('.ts')) {
      const source = fs.readFileSync(fileURLToPath(url), 'utf8')
      return {
        format: 'module',
        source: ts.transpileModule(source, {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
          fileName: fileURLToPath(url),
        }).outputText,
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})

const { parseTraeSSELine } = await import(
  sourceMode ? '../vendor/channel-pack/src/trae.ts' : '../vendor/channel-pack/pack.js'
)
hooks.deregister()

let checks = 0
function check(label, fn) {
  fn()
  checks += 1
  console.log(`ok   ${label}`)
}

// ── 1. metadata 的缓存池记录被解码 ──
check('metadata 解码 prompt_cache_pool_record', () => {
  const ev = parseTraeSSELine(
    'metadata',
    JSON.stringify({
      model: 'glm-5.2',
      session_id: 'abc',
      prompt_cache_pool_record: null,
    }),
  )
  assert.ok(ev !== undefined)
  assert.equal(ev.event, 'metadata')
  // null 必须原样保留，不能被 `??` / 真值判断吞成 undefined
  assert.equal(ev.promptCachePoolRecord, null)
})

check('metadata 缓存池非 null 时原样带出', () => {
  const ev = parseTraeSSELine(
    'metadata',
    JSON.stringify({ prompt_cache_pool_record: { pool: 'trae-global', size: 46720 } }),
  )
  assert.deepEqual(ev.promptCachePoolRecord, { pool: 'trae-global', size: 46720 })
})

// ── 2. null 与「字段不存在」必须区分 ──
check('metadata 没有该字段时是 undefined（≠ null）', () => {
  const ev = parseTraeSSELine('metadata', JSON.stringify({ model: 'glm-5.2' }))
  assert.equal(ev.promptCachePoolRecord, undefined)
  assert.notEqual(ev.promptCachePoolRecord, null)
})

// ── 3. timing_cost 的管线与作答模型 ──
check('timing_cost 解码 pipeline 与 providerModelName', () => {
  const ev = parseTraeSSELine(
    'timing_cost',
    JSON.stringify({ name: 'llm_raw_chat_v2', provider_model_name: 'glm-5.2' }),
  )
  assert.equal(ev.pipeline, 'llm_raw_chat_v2')
  assert.equal(ev.providerModelName, 'glm-5.2')
})

// ── 4. 不得污染既有事件语义 ──
check('metadata / timing_cost 不带 usage', () => {
  for (const name of ['metadata', 'timing_cost']) {
    const ev = parseTraeSSELine(name, JSON.stringify({ name: 'x', prompt_tokens: 9 }))
    assert.equal(ev.usage, undefined, `${name} 不应产生 usage`)
  }
})

check('token_usage 仍然原样带出 usage', () => {
  const ev = parseTraeSSELine(
    'token_usage',
    JSON.stringify({ prompt_tokens: 9224, cache_read_input_tokens: 9216 }),
  )
  assert.equal(ev.usage.prompt_tokens, 9224)
  assert.equal(ev.usage.cache_read_input_tokens, 9216)
})

check('output 事件不受影响', () => {
  const ev = parseTraeSSELine('output', JSON.stringify({ response: 'hi' }))
  assert.equal(ev.response, 'hi')
})

console.log(`\ntrae-diagnostics: ${checks}/${checks} checks passed`)
