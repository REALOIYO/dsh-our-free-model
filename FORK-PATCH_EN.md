# Fork notes (unofficial)

> **This is a personal fork of
> [`Ebony-Vinyl/dsh-our-free-model`](https://github.com/Ebony-Vinyl/dsh-our-free-model),
> based on `v2.5.3`. It does two things:**
>
> 1. **Fix the `code 11128` block on the `buddy` (Tencent CodeBuddy) channel** — unique to this fork
> 2. **Selectively sync upstream fixes unrelated to buddy** — 8 taken so far, see "Upstream sync" below
>
> Not an official release. Does not represent upstream. No official support.
> No pull request will be filed upstream.

## What this branch is

| | |
|---|---|
| This repo | `https://github.com/REALOIYO/dsh-our-free-model` |
| Maintained branch | **`fix/codebuddy-11128`** (set as the repository default) |
| Baseline | tag **`v2.5.3`** (commit `e465d73`) |
| Commits | **15** (1 buddy patch + 3 early cherry-picks + 8 upstream syncs + 3 docs/build) |
| Diff size | **42 files · +2579 / −694 lines** (including the regenerated `pack.js`) |
| Verified on | DSH **`0.2.1-rc.3`** desktop · Windows 11 · OFM `2.5.3` |

`main` is only a mirror of upstream — it carries **none** of this fork's changes.

## All commits (relative to `v2.5.3`)

| # | commit | What | Origin |
|---|---|---|---|
| 1 | `834afe6` | buddy 11128 fingerprint scrubbing | **fork-only** |
| 2 | `32cadab` | docs: mark this repo as a personal fork | this fork |
| 3 | `8680afa` | powered by dsh badge | this fork |
| 4 | `ebba3c2` | preserve forwarded Chat reasoning | cherry-pick upstream #484 |
| 5 | `8782fa3` | echo `reasoning_content` in Chat history | cherry-pick upstream #472 |
| 6 | `caf8b96` | updater rollback rename retry | cherry-pick upstream #503 |
| 7 | `a58b688` | rebuild `pack.js` | this fork |
| 8 | `4a30774` | drop free-lane usage stamps above the advertised window | upstream sync |
| 9 | `3ebc72d` | order qoder thinking efforts by strength | upstream sync |
| 10 | `0c61097` | disable all automatic availability probing | upstream sync |
| 11 | `77f85be` | fix inflated usage counters, scope to Kilo | upstream sync |
| 12 | `577702b` | add a visual-effects toggle | upstream sync |
| 13 | `9c87bf0` | pause fish-tank animation (empty / offscreen) | upstream sync |
| 14 | `da02dad` | add the FleetRelay model gateway | upstream sync |
| 15 | `332dcc3` | invalidate stale egress verdicts, isolate late results | upstream sync |

## Upstream sync (8 commits)

None of these touch buddy, so taking them leaves this fork's buddy behaviour unchanged:

| commit | What | Why taken |
|---|---|---|
| `0c61097` | disable all automatic availability probing | **lowers IP-ban risk** (upstream issue #581: auto-probing gets IPs banned) |
| `332dcc3` | invalidate stale egress verdicts, isolate late results | pairs with the above; stops in-flight probes from a previous egress poisoning the new one |
| `4a30774` | drop free-lane usage stamps above the advertised window | accurate usage accounting |
| `77f85be` | fix inflated usage counters, scope to Kilo | same |
| `3ebc72d` | order qoder thinking efforts by strength | fixes the inverted "weaker towards the right" effort UI |
| `577702b` | add a visual-effects toggle | animations can be turned off |
| `9c87bf0` | pause fish-tank animation (empty / offscreen) | lower idle cost |
| `da02dad` | add the FleetRelay model gateway | new channel |

> The three early cherry-picks (`ebba3c2` / `8782fa3` / `caf8b96`) correspond to
> upstream #484 / #472 / #503 and carry **identical patch-ids** — verbatim imports.

## ⚠️ Divergence from upstream

Upstream **removed both the `buddy` (CodeBuddy CN) and `workbuddy` (INTL) channels**
starting with `v2.5.8` (PR #555, #577).

Upstream's stated reasons:

- issue **#576 "legal letter"** — claims to represent the rights holder and names
  `tencent-fingerprint.ts` and `buddy-adapter.ts` as devices "solely for circumventing technical measures"
- issue **#624**, maintainer reply: reverse proxies risk account bans, and
  "WorkBuddy risk control is aggressive; every reverse-proxy plugin author is lying low"

**This fork deliberately keeps both channels** and does not follow the removal.

| | This fork | Upstream |
|---|---|---|
| Channel count | **13** | 10 |
| buddy / workbuddy | ✅ kept | ❌ removed |

**This is an expected difference, not a bug.** A channel count that differs from
upstream is normal here.

## ⚠️ Install / update notes

The `package.json` version stays at `2.5.3`, but the **contents differ from upstream's
same version**. The `v2.5.3` label only records where the baseline came from; it does
not mean this tree equals upstream's tag.

- **Install**: pin the branch
  ```
  github:REALOIYO/dsh-our-free-model#fix/codebuddy-11128
  ```
  **Do not use `main`** — that is a pure upstream mirror with none of this fork's changes
- **Already installed**: running `pnpm install` / `pnpm update` will make pnpm restore
  the plugin to upstream's release per the specifier in `dependencies`, **wiping the
  buddy patch and all 8 synced fixes**. Reinstall this branch afterwards.

## Why this fork exists

Select any CodeBuddy (`buddy` channel) model in DSH and every message returns:

## Why the fork exists

Selecting any CodeBuddy (`buddy`) model in DSH failed on every request:

```
本轮运行失败
buddy: 请求被拦截，请重新发送
Illegal API invocation from an unapproved channel
INVALID_REQUEST
```

Two gaps in upstream `2.5.3`:

1. The fingerprint table had only `Main branch (you will usually use this for PRs)`;
2. `rewriteTencentContentFingerprints()` is called **only from the `openai-gateway`
   translation layer**. Selecting the `buddy` provider directly in DSH goes through
   `BuddyAdapter.stream()`, which bypasses that layer entirely, so fingerprints are
   sent untouched.

## What changed

| File | Change |
|---|---|
| `vendor/channel-pack/src/openai-gateway/tencent-fingerprint.ts` | Adds `DeepSeek Harness → DSH` rule; adds `sanitizeTencentOutboundMessages()`; whitespace-variant fallback |
| `vendor/channel-pack/src/buddy-adapter.ts` | `stream()` calls the sanitizer after serialization, before building the request body (+5 lines) |
| `vendor/channel-pack/pack.js` | Regenerated by `node scripts/build-channel-pack.mjs` |

Sanitizer invariants:

- **Walks the whole `messages` array**, not just `messages[0]` — persisted sessions
  replay assistant history that also carries the fingerprint;
- **Only touches non-`user` / non-`tool` content**; user text and tool output stay
  byte-for-byte identical;
- **Returns the same string reference when nothing matches**, so the server-side KV
  prefix cache is not needlessly invalidated.

## Evidence (measured locally, not inferred)

Bisecting a real 11KB system prompt against `copilot.tencent.com`:

| Test | Result |
|---|---|
| Full system (11061 chars) | **400 · 11128** |
| Truncated to 9778 chars | 200 |
| Truncated to 9779 chars (ends at `this GUI.`) | **400** |
| Repeated 3× (9778 / 9779) | stable 200 / stable 400 — not a rollout fluctuation |
| Plain letters padded to 20000 chars | 200 — rules out a length threshold |
| `DeepSeek Harness` alone | 200 |
| `this GUI.` alone | 200 |
| **Full system, `DeepSeek Harness` → `DSH`** | **200 ✅** |
| Full system, `DeepSeek Harness` → `DeepSeek` | 200 ✅ |

**This contradicts upstream issues.** #544 / #560 / #568 / #570 all point at the
"DSH identity sentence" `You are an AI agent powered by DeepSeek Harness.`, but DSH
`0.2.1-rc.2` actually emits `You are a coding agent powered by the <model> model.`
— that sentence does not exist. The real trigger is `DeepSeek Harness` appearing
**together with** other system text.

## Why the baseline is pinned to v2.5.3

Upstream `v2.5.8` deleted `vendor/channel-pack/src/buddy-adapter.ts` and
`vendor/channel-pack/src/openai-gateway/tencent-fingerprint.ts` outright (PR #555
retired the channels, PR #577 removed the leftovers), and the PR that would restore
them (**#574**) is **closed, not merged**.

The files this patch touches do not exist on `main`, so there is nothing to rebase
onto. Hence `v2.5.3`.

**Trade-off**: upstream changes after `v2.5.8` are not included. When you need a
specific upstream fix, `cherry-pick` it. **Never `merge upstream/main`** — that drags
the channel deletion along.

## Installing

```bash
github:REALOIYO/dsh-our-free-model#fix/codebuddy-11128
```

⚠️ This replaces the entire plugin. Back up credentials and the account pool first
(`~/.dsh/our-free-model/`, `~/.dsh/channel-pack/`). Upstream documents this as a
manual profile resolution that requires the app to be stopped.

To try it without changing dependency sources, copy `vendor/channel-pack/pack.js`
over the installed `node_modules/dsh-our-free-model/vendor/channel-pack/` — but the
next `pnpm install` reverts it.

## Tracking upstream

```bash
git remote add upstream https://github.com/Ebony-Vinyl/dsh-our-free-model.git
git fetch upstream --tags

git log --oneline fix/codebuddy-11128..upstream/main   # what upstream added
git cherry-pick <sha>                                  # pick selectively
```

Rebuild after editing sources:

```bash
node scripts/build-channel-pack.mjs    # needs esbuild; not a devDependency of this package
```

## What this fork does NOT do

- ❌ No upstream PR, no claim to represent upstream
- ❌ No plugin market, community groups, sponsorships or support (those are upstream's)
- ❌ No compatibility guarantee with future DSH versions
- ❌ Nothing outside the `buddy` / `workbuddy` channels
- ❌ Nothing else from upstream #574 (cooldown isolation, channel registration, check-in)

If upstream restores the `buddy` channels and merges #574, **use upstream** and drop
this fork.

## Links

- Upstream: https://github.com/Ebony-Vinyl/dsh-our-free-model
- Related issues: #544 #560 #568 #570 (fingerprint), #571 (2.5.8), #574 (restore, unmerged)
- License: same as upstream (MIT), see `LICENSE`

---

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
