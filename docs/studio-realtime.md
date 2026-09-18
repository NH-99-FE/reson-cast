# 工作室实时状态同步

链路：业务写入 → PostgreSQL 事务内触发器 → realtime_outbox → QStash 投递端点 → Ably 用户频道 → 精确刷新 tRPC 查询。

首期覆盖 Mux/字幕、AI 标题/简介/封面和视频删除。观看页的状态查询和播放凭证续期不变；不包含互动推送或离线通知中心。事件只包含 ID、类型、版本和生成类型，不包含业务正文、播放令牌和错误详情。

## 安装与部署

1. 按项目已有顺序安装业务数据库结构（包括 `scripts/sql/add-video-generation-jobs.sql`），然后使用数据库 SQL 控制台执行 `scripts/sql/add-realtime-outbox.sql`。该脚本可重跑，包含表、索引和触发器，整体事务提交。**仅执行 `drizzle-kit push` 不会安装触发器**。
2. 设置服务端 `ABLY_API_KEY`，在 Ably 控制台将该密钥的权限限定到 `studio:user:*` 的 publish/subscribe。浏览器不得获取 API key。鉴权端点每次重新验证 Clerk 和本地用户，只签发当前用户具体频道的 subscribe 凭证，TTL 为 10 分钟。
3. 配置已有 `QSTASH_TOKEN`、`QSTASH_CURRENT_SIGNING_KEY`、`QSTASH_NEXT_SIGNING_KEY` 和公网 HTTPS `UPSTASH_WORKFLOW_URL`。该 URL 必须与 QStash 目标 URL 相同，包括签名验证时的协议与域名。
4. 配置完成后构建并部署应用。工作室默认使用 Ably 实时同步，不再保留旧轮询模式或启用开关。提交后的快速唤醒在 Next.js `after()` 内进行；唤醒失败不改变业务结果。
5. 在目标环境执行 `pnpm exec tsx scripts/realtime-outbox.ts schedule`。它以固定 schedule ID 幂等配置每分钟扫描同一投递端点。不同环境应使用独立 QStash 账号或修改 schedule ID，不能共用同一个扫描任务。
6. 用测试账号触发视频/AI/删除变化，确认页面自动更新、数据库 outbox 的 `sent_at` 更新、投递日志无异常，并验证用户订阅权限。

断线时依靠重连、重新订阅、页面回到前台及手动刷新补查，不自动轮询。数据库迁移、服务端凭证和定时扫描是部署的必要步骤。

实时 Provider 只在工作室挂载；一个标签页/身份一个连接。首次连接前也会正常查询数据库。账号切换由身份隔离的 tRPC Provider 和实时连接清理共同隔离缓存与订阅。

## 原子性与故障恢复

使用数据库触发器替代在每个业务 CTE 内重复写 Outbox。AFTER 行触发器在同一数据库事务中执行，插入失败会回滚业务更新；原有 AI CTE、并发比较和失败回调保持原样。同值更新不会产生事件。视频和账号删除不会级联删除 Outbox，物理删除事件使用 OLD 中的归属用户信息。

每次最多领取 50 条事件，`FOR UPDATE SKIP LOCKED` 避免重复领取，2 分钟租约允许崩溃恢复。确认和失败写回都要求匹配领取令牌；过期执行器无法覆盖新的领取结果。外部 Ably 调用在事务之外，10 秒超时、无 SDK 自动重试。发布成功但数据库确认失败可能导致重复投递，客户端按事件 ID 去重（最近 1000 个），乱序或超出窗口的事件仅重新读取数据库。

失败延迟使用指数退避和随机抖动，最多 15 分钟；20 次失败后停留在 `failed_at` 状态，等待人工重放。QStash 仅负责唤醒和请求级重试，数据库记录负责逐事件重试。扫描器也补偿快速唤醒丢失、部分事务已提交但请求失败等场景。批次满时再次唤醒以排空积压。

Ably 发布确认不代表所有浏览器已经收到消息。客户端断线期间无需读取事件历史，恢复后读取数据库最终状态。业务任务的 QStash 调度可靠性仍沿用现有逻辑，本期只保障实时通知的投递。

## 运维

- 查看待发送及失败记录：`pnpm exec tsx scripts/realtime-outbox.ts status`。
- 排除故障后重放指定失败事件：`pnpm exec tsx scripts/realtime-outbox.ts replay <event UUID>`。该命令只重置最终失败且未发送的事件，下次扫描会领取；不重启 AI 或删除任务。
- 每次扫描输出 pending、oldest_pending_at、failed 和累计 retries。建议为 failed > 0 或最老待发送记录超过 5 分钟配置现有日志系统告警；此仓库没有配置外部告警接收端。
- 每次扫描最多删除 1000 条已发送超过 7 天的记录。未发送和最终失败记录不会自动清理。
- 不要删除 Outbox 表而保留触发器，否则业务写入将失败。
- 投递服务故障期间 Outbox 保留事件；恢复后扫描器继续投递。

## 验证

`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm test:ui`。

数据库测试使用 PGlite 执行真实迁移和 SQL，覆盖事务回滚、状态去重、删除保留、领取租约、旧令牌失效、批次上限、重试和重放。鉴权测试验证签名、正文、目标 URL、过期和密钥轮换，以及身份和订阅范围。浏览器测试使用模拟 Ably/服务端与真实 React 表单/tRPC 查询缓存，覆盖推送更新、草稿保留、删除失效、断线恢复和连接清理；不能替代部署环境的真实 Clerk/Ably/QStash 联调。
