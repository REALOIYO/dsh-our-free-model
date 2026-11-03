# 本 fork 说明（非官方）

> **这是 [`Ebony-Vinyl/dsh-our-free-model`](https://github.com/Ebony-Vinyl/dsh-our-free-model)
> 的个人 fork，基于 `v2.5.3` 做三件事：**
>
> 1. **修好 `buddy`（腾讯 CodeBuddy）渠道的 `code 11128` 拦截**（本 fork 独有）
> 2. **修好 `codearts`（华为 CodeArts）渠道「发消息即报密钥无效」**（本 fork 独有）
> 3. **选择性同步上游与两者无关的修复**（已摘 8 个，见下方「上游同步记录」）
>
> 不是官方发布，不代表上游立场，不提供官方支持，也不会向上游提 PR。

## 我是谁 / 这个分支是什么

| 项 | 值 |
|---|---|
| 本仓库 | `https://github.com/REALOIYO/dsh-our-free-model` |
| 维护分支 | **`fix/codebuddy-11128`**（已设为仓库默认分支） |
| 基线 | tag **`v2.5.3`**（commit `e465d73`） |
| 提交总数 | **19 个**（buddy 补丁 2 + codearts 补丁 2 + 早期 cherry-pick 3 + 上游同步 8 + 文档/构建 4） |
| 改动规模 | **43 个文件 · +3005 / −774 行**（含重新生成的 `pack.js`） |
| 验证环境 | DSH **`0.2.1-rc.5`** 桌面版 · Windows 11 · OFM `2.5.3` |

`main` 分支只是上游镜像，**不包含任何本 fork 的修改**。

## 全部提交清单（相对 `v2.5.3`）

| # | commit | 内容 | 来源 |
|---|---|---|---|
| 1 | `834afe6` | buddy 11128 指纹清洗 | **本 fork 独有** |
| 2 | `32cadab` | 文档标注个人 fork | 本 fork |
| 3 | `8680afa` | powered by dsh 徽章 | 本 fork |
| 4 | `ebba3c2` | preserve forwarded Chat reasoning | cherry-pick 上游 #484 |
| 5 | `8782fa3` | Chat 历史回传 reasoning_content | cherry-pick 上游 #472 |
| 6 | `caf8b96` | updater rollback 重命名重试 | cherry-pick 上游 #503 |
| 7 | `a58b688` | 重建 `pack.js` 产物 | 本 fork |
| 8 | `4a30774` | 丢弃超出窗口的 free-lane usage 标记 | 上游同步 |
| 9 | `3ebc72d` | qoder 思考档位按强度序下发 | 上游同步 |
| 10 | `0c61097` | 禁用所有自动可用性探测请求 | 上游同步 |
| 11 | `77f85be` | 修正异常计数累积，限定 Kilo 路由 | 上游同步 |
| 12 | `577702b` | 新增视觉特效开关 | 上游同步 |
| 13 | `9c87bf0` | 鱼缸动画暂停（空缸 / 视口外） | 上游同步 |
| 14 | `da02dad` | 接入 FleetRelay 线上模型网关 | 上游同步 |
| 15 | `332dcc3` | 旧出口判定失效 + 迟到结果隔离 | 上游同步 |
| 16 | `f5ec78c` | 文档同步到真实状态 | 本 fork |
| 17 | `711fdeb` | 补第 3 条腾讯 11128 指纹（@ 路径说明段） | 本 fork |
| 18 | `793f934` | codearts：去掉会被网关拒绝的 user-agent | **本 fork 独有** |
| 19 | `bb0d4ef` | codearts：推理档位顺序修正 | **本 fork 独有** |

## codearts 渠道补丁（本 fork 独有）

### 症状

在 DSH 里选 `codearts` 的模型（如 `deepseek-v4.1-flash`）发「你好」，
直接报**「API 密钥无效」**（错误码 `AUTH`）。

### 根因不是密钥

凭证完全有效。问题出在**宿主注入的 `user-agent`**：

| UA | 结果 |
|---|---|
| `deepseek-harness/<ver> (+https://github.com/deepseek-ai/deepseek-harness)` | ❌ 403 `TM.00000001`「网络繁忙」 |
| 不带 UA | ✅ 200 正常出流 |
| `codearts` 自己的 UA | ✅ 200 正常出流 |

该 UA 来自 DSH 内核的 `attributionHeaders()`
（`dsh-llm/lib/types/attribution.js`，只返回一个 `user-agent`）。
适配器若以 `new Headers(attributionHeaders())` 起手就会带上它，
华为云 APIG 网关不接受。

> 同仓库的 `buddy-adapter.ts` 早有同类注释（「必须用 set 覆盖
> `attributionHeaders()` 注入的框架 UA」），`codearts` 这条路径漏了。

### 修法

对齐参考实现 [`elegant01/dsh-codearts`](https://github.com/elegant01/dsh-codearts)
的 `upstream.ts`：

- 不再以 `attributionHeaders()` 起手，改为裸 `new Headers()`
- 用 `app-id: CodeAgent3.0` + `is_confidential: false` + `X-Language: zh-cn` 标识客户端
- 补 `Accept: text/event-stream`
- `Chat-Id` / `Session-Id` 保持在签名**之后**追加（签进 canonical 会被拒签）

### 附带修正：推理档位顺序

`resolveModel` 的 `efforts` 原为 `['on','off']`，DSH 选择器按数组顺序渲染，
导致滑块「左=开启、右=关闭」，与其他 provider（左弱右强）相反。

改为 `['off','on']`。`defaultEffort` 仍为 `'on'`，默认行为不变。

### 判据

`~/.dsh/channel-pack/token-ledger.json` 里：

- 修复前：`codearts|deepseek-v4.1-flash` → 4 请求 / 4 错 / 输入输出全 0
- 修复后：正常出流，输出 token 非 0

### 遗留现象（非本补丁范围）

- **首字延迟偏高**（实测平均 20+ 秒）：CodeArts 服务端排队，与 UA 无关
- **`TM.00001041 并发会话数已达上限(3个)`**：华为侧按账号限并发，
  多账号时插件会自动换号；若某账号长期占满，可在 Channel Pack 里把它拖到后面


## trae 缓存：字段补了，但上游本机不给值（本 fork 独有）

### 补了什么

`trae-adapter.ts` 的 `token_usage` 分支原先只取 `prompt_tokens` /
`completion_tokens` / `reasoning_tokens`，把上游那两个**非 OpenAI 标准**的
`cache_read_input_tokens` / `cache_creation_input_tokens` 直接丢了。
现已搬运到 `cacheReadTokens` / `cacheWriteTokens`（仅 > 0 时才带，不给
从不报缓存的模型伪造字段）。

### 但这不是「缓存坏了」的原因

2026-11-04 实测：**补上搬运后本机 trae 的 cacheRead 仍然是 0**。

取证方式：按 `dingminhua/dsh-connect-trae` 的 `docs/ISSUE10_DIAGNOSIS.md`
原样复刻其复现脚本的请求形态（PREFIX 预热 → PREFIX+SUFFIX → 逐字节相同，
`role:'user'` 单条消息、无 system），覆盖：

| 维度 | 取值 |
|---|---|
| 账号 | `9C00754B`、`8BD69571` |
| 模型 | `glm-5.2`、`deepseek-v4.1-flash`、`Doubao-Seed-2.1-Pro` |
| 通道 | `solo_agent`、`solo_work_lite` |

`prompt_tokens` **精确复现**了该文档的 `5258 / 9224 / 9224`，证明请求形态
与取证条件一致；但 `cache_read_input_tokens` 恒为 0，从未出现该文档记录的
`5248 / 9216`。同一时刻本机 `codearts` / `qodercn` / `workbuddy` 的
cacheRead 均非 0，DSH 侧上报链路正常。

原始响应（本机，逐字节）：

```json
{"name":"","prompt_tokens":9224,"completion_tokens":177,"total_tokens":9401,
 "cache_creation_input_tokens":0,"cache_read_input_tokens":0,"reasoning_tokens":171,
 "prompt_tokens_total":0,"completion_tokens_total":0,"total_tokens_total":0,
 "cache_creation_input_tokens_total":0,"cache_read_input_tokens_total":0,
 "reasoning_tokens_total":0,"cluster":"normal_context"}
```

### 结论

- 字段搬运是**必要**的：上游一旦报值，不搬就等于界面恒 0；
- 但本机这条通道的上游当前**不返回非 0 缓存**，属上游行为，适配器无法凭空造出来；
- 所以「修完还是 0」不是回归，不要再去翻适配器代码。


## 上游同步记录（8 个）

这 8 个提交与 buddy **无任何交集**，摘入后不改变本 fork 的 buddy 行为：

| commit | 内容 | 摘取理由 |
|---|---|---|
| `0c61097` | 禁用所有自动可用性探测请求 | **降低 IP 被封风险**（上游 issue #581：自动探测会导致封禁） |
| `332dcc3` | 旧出口判定失效 + 迟到结果隔离 | 与上一条配套；防止旧出口的在途探测结果污染新出口 |
| `4a30774` | 丢弃超出窗口的 free-lane usage 标记 | 用量统计准确 |
| `77f85be` | 修正异常计数累积，限定 Kilo 路由 | 同上 |
| `3ebc72d` | qoder 思考档位按强度序下发 | 修正「越往右越弱」的档位 UI 错乱 |
| `577702b` | 新增视觉特效开关 | 界面可关闭动画 |
| `9c87bf0` | 鱼缸动画暂停（空缸 / 视口外） | 降低空闲占用 |
| `da02dad` | 接入 FleetRelay 线上模型网关 | 新增渠道 |

> 早期 cherry-pick 的 `ebba3c2` / `8782fa3` / `caf8b96` 三项，对应上游 #484 / #472 / #503，
> **patch-id 与上游完全一致**，属于原样搬入。

## ⚠️ 与上游的策略分歧

上游自 `v2.5.8` 起**移除了 `buddy`（CodeBuddy 国内版）与 `workbuddy`（国际版）两个渠道**
（PR #555、#577）。

移除原因（上游自己的说明）：

- issue **#576「律师函」** —— 声称代表权利人，将 `tencent-fingerprint.ts` 与
  `buddy-adapter.ts` 列为「专用于避开技术措施」的装置
- issue **#624** 维护者回复：「反代现在有可能封号啊」「WorkBuddy 风控强度大，
  所有反代插件作者都在避风头」

**本 fork 主动保留这两个渠道**，不跟随上游的移除动作。
因此：

| 项 | 本 fork | 上游 |
|---|---|---|
| 渠道数 | **13** | 10 |
| buddy / workbuddy | ✅ 保留 | ❌ 已移除 |

**这是预期差异，不是 bug。** 若看到渠道数与上游不同，属正常。

## ⚠️ 安装 / 更新注意

本仓库 `package.json` 的版本号仍是 `2.5.3`，但**内容已不同于上游同版本**。
`v2.5.3` 这个号只表示基线来源，不表示与上游该 tag 完全一致。

- **安装**：认分支 `#fix/codebuddy-11128`
  ```
  github:REALOIYO/dsh-our-free-model#fix/codebuddy-11128
  ```
  **不要用 `main`** —— 那是纯上游镜像，不含任何本 fork 改动
- **已在用的人**：若执行 `pnpm install` / `pnpm update`，插件会被 pnpm 按
  `dependencies` 里的 specifier 还原成上游原版，**buddy 补丁与 8 个修复会全部丢失**。
  届时需重新安装本分支。

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

---

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
