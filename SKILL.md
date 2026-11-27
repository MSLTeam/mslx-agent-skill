---
name: mslx-agent-skill
description: >-
  管理 MSLX 上的 Minecraft 服务器。用于通过 MSLX MCP 部署和诊断实例、管理 Java、
  模组与玩家权限，以及执行备份恢复、FRP 和计划任务。
---

# MSLX Agent Skill - Minecraft 服务器运维与 MCP 协议规范

本指南是 MSLX 官方为 AI Agent（Google Antigravity、Cursor、Workbuddy、Qoder、Claude Desktop、Windsurf、豆包等）提供的**权威运维指导规范与 MCP 工具集手册**。作为智能运维助手，在管理 Minecraft 服务器、排查故障、执行备份恢复及调用 MCP 工具时，**必须严格遵守以下铁律与规范**。

---

## 连接与工具调用

1. 在 MSLX 面板的 AI 助手 → 连接外部 AI（MCP）中获取目标节点的地址和令牌。支持远程 MCP 的客户端使用 Streamable HTTP 和 `Authorization: Bearer <MCP_TOKEN>` 请求头。仅支持 Stdio 的客户端可以使用 npm 包提供的 SSE 桥接。
2. 连接后先调用 `tools/list`。以当前节点和令牌返回的工具及 `inputSchema` 为准。令牌应留在连接配置中。客户端缺少 MCP 连接能力时，可以根据用户提供的信息给出运维指导。
3. 用户已指定实例，或面板提供了明确的当前实例时，用对应的 ID。目标有歧义时，先查询实例列表并核对目标。

## 运维规则

- 查询支持的核心或 Minecraft 版本时，使用 `query_available_server_cores`。快照端使用 `vanilla-snapshot`，正式版原版端使用 `vanilla`。
- 执行用户明确要求的删除、覆盖或恢复操作前，核对实例、文件路径或备份编号。工具返回待确认操作编号后，引导管理员在同一节点的 AI 助手 → MCP → 待确认操作中审批。用 `query_operation_status` 查询结果，避免重复提交。
- **完全权限模式（Full Permission Mode）**：该开关默认关闭。当服务端开启完全权限模式时，`initialize` 的 `instructions` 与 `/mcp/skill.md` 会发出高危警告，此时所有写入、覆盖、删除、还原备份与实例终端命令行均无需 MCP 面板审批而直接执行。**Agent 必须极其慎重操作，在执行任何不可逆或高风险动作前务必先向用户说明风险并征得用户明确同意。**
- **实例命令行终端权限**：MCP 面板上的「默认开启终端权限」默认关闭。未开启时，调用 `run_server_terminal` 前必须先通过 `request_terminal_permission(server_id, duration_hours, duration_minutes, reason)` 申请临时权限并引导管理员在 MCP 页审批；审批通过后在有效期内可直接执行（Windows 默认 PowerShell，macOS 默认 zsh，Linux 默认 bash）。
- **大文件上传与整合包导入**：使用 `create_mc_server` 部署整合包/核心时，`package_local_path` / `core_local_path` 指 MSLX 宿主机路径，`package_url` 指宿主机可达 URL；若需由外部 Agent 直接上传本地文件，可先通过 HTTP `POST /mcp/uploads` 或 `stage_upload_file` 暂存获取 `uploadId`（即 `fileKey`），再传入 `core_file_key`、`package_file_key` 或 `upload_server_file` / `upload_panel_image` / `upload_mslx_plugin`。
- **后台任务进度跟踪**：触发备份、还原、建服、压缩或下载等异步操作后，若原接口未直接返回 `taskId`，调用 `list_background_tasks` 获取当前用户的完整后台任务列表，结合实例 ID、任务类型、标题和目标文件名匹配进度；已知 `task_id` 时使用 `query_background_task` 或 `cancel_background_task`。

## Minecraft 与 Java 版本对应准则 (Java Matrix)

根据 Minecraft 游戏核心及服务端核心（Forge / NeoForge / Fabric / Paper / Spigot 等）的版本，严格匹配相应的 Java 运行环境：

| Minecraft / 核心版本 | 匹配 Java 大版本 | MSLX 运行环境标识 |
| :--- | :--- | :--- |
| **NeoForge 26.x / MC 26.1+** | **Java 25** (强制) | `MSLX://Java/25` |
| **MC 1.20.5 - 1.21.11** | **Java 21** (推荐) | `MSLX://Java/21` |
| **MC 1.18 - 1.20.4** | **Java 17** (推荐) | `MSLX://Java/17` |
| **MC 1.17 / 1.17.1** | **Java 16** (推荐) | `MSLX://Java/16` |
| **MC 1.13 - 1.16.5** | **Java 11** 或 **Java 8** | `MSLX://Java/11` / `MSLX://Java/8` |
| **MC 1.12.2 及更低旧版本** | **Java 8** (强制) | `MSLX://Java/8` |

### Java 诊断与安装

- 排查启动失败时，结合日志、核心版本和 `query_java_environments` 判断运行环境。宿主机刚安装过 JDK 或列表可能过期时，使用 `force_rescan: true`。
- 需要部署匹配的 JDK 时，根据工具 schema 使用 `install_online_java`，或用 `update_instance_settings` 绑定相应的 `MSLX://Java/<大版本>`。绑定后按用户要求启动实例，并检查启动状态。

---

## 防御性备份与灾备恢复指南 (Backup-First Protocol)

在管理游戏存档与关键数据时，务必恪守数据安全准则：
1. **前置防御性备份**：
   - 在执行重大破坏性操作前（如升级核心、批量删除/覆盖文件、更新迁移大型模组、调整深层世界生成参数），**主动询问并协助用户先行调用 `create_server_backup` 备份**！
2. **完整回档还原黄金工作流**：
   - **Step 1**：调用 `list_server_backups(server_id)` 获取历史备份列表供用户核对时间戳与文件名。
   - **Step 2**：检查服务器状态，若在线则调用 `control_server(server_id, action="stop")` 停止服务器（Minecraft 运行中禁止直接解压覆盖世界存档）。
   - **Step 3**：调用 `restore_server_backup(server_id, file_name)`，记录返回的操作编号。
   - **Step 4**：管理员在同一节点的 AI 助手 → MCP → 待确认操作中确认，无需 API Key。系统自动执行，用 `query_operation_status` 查询状态，成功后再考虑开服。

---

## MSLX MCP 工具目录

先调用 tools/list，以当前令牌实际可见的工具名和 inputSchema 为准。

### 1. 实例生命周期与基础配置 (Instance & Config)
- `update_instance_settings`: 修改实例属性（绑定 Java、内存大小 `max_m`/`min_m`、核心文件名 `core`、JVM 参数 `args`、崩溃自启等）。
- `update_server_config`: 修改 `server.properties` 键值（如端口 `server-port`、正版验证 `online-mode`、难度 `difficulty`、PVP、最大玩家等）。
- `control_server`: 控制服务器电源状态，`action` 支持 `"start"`、`"stop"`、`"restart"`。
- `query_server_status`: 查询服务器实时状态（在线状态、PID、CPU 使用率、内存占用、启动耗时等）。
- `query_operation_status`: 按 `operation_id` 查询当前令牌提交的待审批操作及执行结果。
- `query_system_metrics`: 查询宿主机与实例的系统级性能指标（CPU/内存负载与磁盘状态）。

### 2. 服务器部署与核心生态 (Deployment & Cores)
- `create_mc_server`: 全模式开服部署（在线镜像核心、上传核心 `core_file_key` / 整合包 `package_file_key`、本地/远程整合包 zip、MCDR 架构及自定义模式）。
- `query_available_server_cores`: 动态实时检索官方镜像站支持的服务端核心列表（支持 `vanilla`、`vanilla-snapshot`、`paper`、`neoforge`、`fabric` 等）。
- `query_creation_status`: 轮询后台开服/解压任务的进度百分比与日志。
- `agree_server_eula`: 自动将 `eula.txt` 写入 `eula=true`，解决开服首次启动协议阻塞。

### 3. 后台任务监控 (Background Tasks)
- `list_background_tasks`: 查询当前用户的后台任务列表（按 `server_id`、`task_type`、`state`、`keyword` 过滤），适用于部分 SDK 接口未返回 `taskId` 时按类型与标题追踪进度。
- `query_background_task`: 根据 `task_id` 查询单个后台任务的实时进度、状态消息及节点同步结果。
- `cancel_background_task`: 取消当前用户排队中或运行中的后台任务（只读令牌不可调用）。

### 4. Java 运行环境编排 (Java Management)
- `query_java_environments`: 扫描宿主机已安装的 Java 环境列表（支持 `force_rescan: true` 强制全盘重扫）。
- `install_online_java`: 一键下载、校验并部署指定大版本 JDK（如 Java 8, 11, 16, 17, 21, 25）。

### 5. 文件安全管理与上传接口 (File Operations & Uploads)
- HTTP 文件暂存端点：`POST /api/plugin/mslx-plugin-ai-agents/mcp/uploads`（Bearer Token 鉴权，支持 `multipart/form-data` 或原始二进制流，返回 `uploadId` / `fileKey`）、`GET .../mcp/uploads/{uploadId}/inspect`、`DELETE .../mcp/uploads/{uploadId}`（只读令牌禁止调用）。
- `list_server_files`: 列出服务器目录或子目录（`plugins`、`mods`、`logs` 等）下的文件清单。
- `read_server_file`: 安全读取文本文件（采用 `FileShare.ReadWrite` 共享模式，运行态无锁读取）。
- `write_server_file`: 写入或修改配置文件（已存在文件会自动挂起触发前端授权卡片）。
- `delete_server_file`: 删除文件或目录（自动挂起触发前端二次确认卡片）。
- `copy_server_file`: 复制文件或目录（用于配置热备份与归档）。
- `move_server_file`: 移动或重命名文件（用于排错时重命名 `.jar.disabled`）。
- `stage_upload_file`: 将文本、Base64 或宿主机本地文件暂存并获取可复用的 `uploadId`。
- `inspect_uploaded_archive`: 检查已上传 `.zip` / `.mrpack` 压缩包内的候选核心 `.jar`。
- `upload_server_file`: 上传文件、图标 (`server-icon.png`) 或配置文本到目标实例目录（覆盖已有文件需确认）。
- `upload_panel_image`: 上传面板静态背景图并可选绑定至亮/暗色主题背景。
- `upload_mslx_plugin`: 上传并热加载本地 `.dll` 插件到 MSLX 面板。
- `update_panel_ssl`: 上传自定义 SSL 证书/私钥 PEM 文本或切换自签证书配置。

### 6. 诊断、控制台与实例终端 (Diagnostics, Console & Terminal)
- `read_server_log`: 读取 `logs/latest.log` 运行日志或 `crash-reports/` 最新崩溃报告。
- `send_server_command`: 向服务器控制台发送 Minecraft 游戏指令（如 `say`、`whitelist`、`time set day` 等）。
- `request_terminal_permission`: 当「默认开启终端权限」未开启时，向管理员申请指定实例的临时命令行权限（须附带 `duration_hours` / `duration_minutes` 与 `reason`）。
- `run_server_terminal`: 自动切换到目标实例根目录（或子目录）拉起命令行执行操作（Windows 默认 PowerShell，macOS 默认 `zsh`，Linux 默认 `bash`）。

### 7. 备份与灾备恢复 (Backup & Recovery)
- `create_server_backup`: 触发全量世界存档备份，生成 `mslx-backup_yyyyMMdd_HHmmss.zip`。
- `list_server_backups`: 查询历史备份列表、时间戳、物理路径与文件大小。
- `restore_server_backup`: 还原备份存档（不可逆覆盖操作，触发二次授权卡片）。
- `delete_server_backup`: 删除指定的旧备份文件。

### 8. FRP 内网穿透与计划任务 (Frp & Automation)
- `query_frp_status`: 查询 FRP 穿透隧道列表与运行状态。
- `control_frp_tunnel`: 控制隧道启停（`start`/`stop`）或提取最近 50 条运行日志（`log`）。
- `manage_scheduled_tasks`: 定时任务调度（`list`/`create`/`delete`/`toggle`，支持备份、重启、指令执行等 Cron 任务）。

### 9. 玩家与安全治理 (Player & Lifecycle Ops)
- `force_kill_server`: 服务器死锁时强制强杀进程。
- `delete_server_instance`: 彻底删除服务器实例（`delete_files=true` 时触发二次确认卡片）。
- `query_players`: 综合查询当前在线玩家、历史登录缓存与最后活动时间。
- `manage_whitelist`: 管理白名单（`list`/`add`/`remove`，热重载生效）。
- `manage_ops`: 管理 OP 管理员权限（`list`/`add`/`remove`，支持 1~4 级权限）。
- `manage_bans`: 管理封禁名单（`list`/`ban_player`/`unban_player`/`ban_ip`/`unban_ip`）。

### 10. 模组、插件与资源生态 (Resource Ops)
- `search_mc_resources`: 统一聚合搜索 Modrinth 与 CurseForge 资源生态。
- `query_resource_versions`: 查询目标资源的版本兼容性、加载器适配与下载地址。
- `download_file_to_server`: 高速下载远程资源并落盘至 `mods/` 或 `plugins/`。
- `audit_client_only_mods`: 深度扫描 `mods/` 目录，精准检出客户端渲染独占模组，防止 Dedicated Server 启动崩溃。
- `manage_mod_plugin_state`: 管理模组/插件启用状态（`list`/`enable`/`disable`/`delete`）。
- `query_python_environments`: 扫描宿主机 Python 环境与 MCDR 安装状态。
- `extract_archive`: 高速解压 `.zip`、`.tar`、`.7z` 等归档包。
- `compress_files`: 打包目录或文件为 `.zip` 压缩包。
- `list_server_mods_plugins`: 列出模组与插件基础清单。

---

## 客户端接入

从面板复制 MCP 配置，或查看 npm 包的 README 获取 Stdio 桥接示例。使用回环地址时，发起 MCP 连接的进程须与 MSLX 服务在同一台机器上。
