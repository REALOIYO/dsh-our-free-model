# 本 fork 说明（非官方）

> **这是 [`Ebony-Vinyl/dsh-our-free-model`](https://github.com/Ebony-Vinyl/dsh-our-free-model)
> 的个人 fork，只做一件事：修好 `buddy`（腾讯 CodeBuddy）渠道的 `code 11128` 拦截。**
>
> 不是官方发布，不代表上游立场，不提供官方支持，也不会向上游提 PR。

## 我是谁 / 这个分支是什么

| 项 | 值 |
|---|---|
| 本仓库 | `https://github.com/REALOIYO/dsh-our-free-model` |
| 维护分支 | **`fix/codebuddy-11128`** |
| 基线 | tag **`v2.5.3`**（commit `e465d73`） |
| 补丁 commit | `834afe6` |
| 改动量 | 源码 83 行 + 重新生成的 `vendor/channel-pack/pack.js` |
| 验证环境 | DSH `0.2.1-rc.2` 桌面版 · Windows 11 · OFM `2.5.3` |

`main` 分支只是上游镜像，**不包含任何本 fork 的修改**。

## 为什么要做这个 fork

在 DSH 里选 CodeBuddy（`buddy` 渠道）的任何模型，发任何内容都返回：

```
本轮运行失败
buddy: 请求被拦截，请重新发送
Illegal API invocation from an unapproved channel
INVALID_REQUEST
```

上游 `2.5.3` 有两个缺口：

1. 指纹规则表只有 `Main branch (you will usually use this for PRs)` 一条；
2. `rewriteTencentContentFingerprints()` **只被 `openai-gateway` 转换层调用**。
   DSH 直接选 `buddy` provider 时走 `BuddyAdapter.stream()`，完全不经过转换层，
   指纹原样发出。

## 改了什么

| 文件 | 改动 |
|---|---|
| `vendor/channel-pack/src/openai-gateway/tencent-fingerprint.ts` | 规则表新增 `DeepSeek Harness → DSH`；新增 `sanitizeTencentOutboundMessages()`；空白变体兜底 |
| `vendor/channel-pack/src/buddy-adapter.ts` | `stream()` 在序列化后、构造请求体前调用清洗（+5 行） |
| `vendor/channel-pack/pack.js` | 由 `node scripts/build-channel-pack.mjs` 重新生成 |

清洗的三条约束：

- **遍历整个 `messages` 数组**，不只 `messages[0]`（存量会话的 assistant 历史也会回传指纹）；
- **只动非 `user` / 非 `tool` 内容**，用户原话与工具结果逐字符不变；
- **未命中即原样返回同一字符串**，不给服务端 KV 前缀缓存制造无谓失效。

## 实测证据（本机，非推测）

用真实 11KB system prompt 对 `copilot.tencent.com` 二分：

| 测试 | 结果 |
|---|---|
| 完整 system（11061 字符） | **400 · 11128** |
| 截断到 9778 字符 | 200 |
| 截断到 9779 字符（结尾正好 `this GUI.`） | **400** |
| 重复 3 次（9778 / 9779） | 稳定 200 / 稳定 400 —— 非灰度波动 |
| 纯字母填充到 20000 字符 | 200 —— 排除长度阈值 |
| `DeepSeek Harness` 单独出现 | 200 |
| `this GUI.` 单独出现 | 200 |
| **完整 system，`DeepSeek Harness` → `DSH`** | **200 ✅** |
| 完整 system，`DeepSeek Harness` → `DeepSeek` | 200 ✅ |

**结论与上游 issue 不同。** #544 / #560 / #568 / #570 都定位到「DSH 身份句
`You are an AI agent powered by DeepSeek Harness.`」，但 DSH `0.2.1-rc.2` 实际生成的
是 `You are a coding agent powered by the <model> model.`，**不含那句**。真正的触发面
是 system 里 `DeepSeek Harness` 与其它文本的组合出现。

## 为什么基线锁 v2.5.3

上游 `v2.5.8` 已通过 PR #577 把 `vendor/channel-pack/src/buddy-adapter.ts`、
`vendor/channel-pack/src/openai-gateway/tencent-fingerprint.ts` **整个删除**
（`#555` 退役渠道，`#577` 清理残留），而恢复渠道的 PR **#574 是 closed 未合并**。

补丁要改的文件在 `main` 上不存在，rebase 无处落。所以本分支从 `v2.5.3` 起。

**代价**：拿不到 `v2.5.8` 之后的上游改动。需要某个上游修复时，用 `cherry-pick`
单独挑，**不要 `merge upstream/main`**（会把渠道删除一起带进来）。

## 安装

```bash
github:REALOIYO/dsh-our-free-model#fix/codebuddy-11128
```

⚠️ 会替换整个插件。安装前请自行备份凭据与账号池
（`~/.dsh/our-free-model/`、`~/.dsh/channel-pack/`）。上游说明里这属于需要在停机状态
手动解析 profile 的操作。

只想临时用、不想改依赖源时，也可以只把 `vendor/channel-pack/pack.js` 覆盖到已安装的
`node_modules/dsh-our-free-model/vendor/channel-pack/` —— 但 `pnpm install` 后会失效。

## 与上游保持同步

```bash
git remote add upstream https://github.com/Ebony-Vinyl/dsh-our-free-model.git
git fetch upstream --tags

git log --oneline fix/codebuddy-11128..upstream/main   # 上游多了什么
git cherry-pick <sha>                                  # 按需挑，逐个提交
```

改完源码需重新构建：

```bash
node scripts/build-channel-pack.mjs    # 需要 esbuild，非本包 devDependency
```

## 本 fork 不做什么

- ❌ 不向上游提 PR、不代表上游意见
- ❌ 不提供插件市场、交流群、赞助、技术支持（那些都是上游的）
- ❌ 不保证与未来 DSH 版本兼容
- ❌ 不处理 `buddy` / `workbuddy` 以外的任何渠道问题
- ❌ 不修复上游 #574 涉及的其他内容（连坐冷却、渠道注册、签到等）

如果上游恢复了 `buddy` 渠道并合并了 #574，**请直接用上游**，本 fork 即可弃用。

## 相关

- 上游仓库：https://github.com/Ebony-Vinyl/dsh-our-free-model
- 相关 issue：#544 #560 #568 #570（指纹定位）、#571（2.5.8）、#574（恢复渠道，未合并）
- 许可证：与上游一致（MIT），见 `LICENSE`
