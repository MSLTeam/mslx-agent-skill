# MSLX Agent Skill (`@mslteam/mslx-agent-skill`)

> **MSLX 官方 Minecraft 服务器运维与全平台 MCP 协议桥接 Agent Skill**
> 面向 Google Antigravity、Cursor、Workbuddy、Qoder、Claude Desktop、Windsurf、豆包等国内外主流 AI Agent，提供完整的 Minecraft 智能运维规则、Java 版本映射矩阵、容灾回档协议与 MCP 运维工具支持。

[![npm version](https://img.shields.io/npm/v/@mslteam/mslx-agent-skill.svg)](https://www.npmjs.com/package/@mslteam/mslx-agent-skill)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

---

## 🌟 核心特性

- 🚀 **零重依赖原生架构**：完全基于 Node.js 原生模块 (`http`, `https`, `events`, `readline`, `url`) 构建，无需安装任何体积庞大的第三方 npm 依赖，秒级拉起、轻量高效。
- 🔌 **全双工 Stdio-to-SSE 桥接**：完美打通基于标准输入输出 (Stdio) 的本地 Agent 与 MSLX 宿主后端 Server-Sent Events (SSE) / JSON-RPC 2.0 远程 MCP 服务的协议转换。
- 🛡️ **数据安全防御机制**：深度集成高危操作二次确认卡片防护、防御性备份机制 (Backup-First) 与 Dedicated Server 客户端独占模组深度体检。
- 🌐 **双通道镜像发布**：内置自动化双通道发布引擎，同时支持组织级包名 `@mslteam/mslx-agent-skill` 与全局精简包名 `mslx-agent-skill`。
- 📦 **全平台一键开箱即用**：提供针对 Antigravity、Cursor、Workbuddy、Qoder、Claude Desktop、Windsurf 以及纯文本大模型的即拷即用配置。

---

## 💻 CLI 命令行使用指南

`install <skills-dir>` 会在指定的技能目录下写入 `mslx-agent-skill/SKILL.md`。使用目标客户端的技能目录，例如下面用工作区的 `.agents/skills`。已有同名文件时会提示，更新前可先备份旧文件。安装后需在客户端另行配置 MCP 连接。

支持远程 MCP 的客户端可以直接使用 WebPanel → AI 助手 → 连接外部 AI（MCP）中的 Streamable HTTP 地址和 Bearer 请求头。下方 Stdio 示例用于需要本地桥接的客户端。使用 `localhost` 时，桥接进程和 MSLX 服务应在同一台机器上。

```bash
# 查看帮助与参数说明
npx @mslteam/mslx-agent-skill --help

# 查看 CLI 版本
npx @mslteam/mslx-agent-skill --version

# 安装到工作区的技能目录
npx -y @mslteam/mslx-agent-skill install .agents/skills

# 快速打印完整的官方 Agent Skill 规范（适用于 Antigravity / 豆包预设提示词）
npx @mslteam/mslx-agent-skill skill

# 启动 Stdio-to-SSE MCP 协议桥接（供 Agent 自动化调用）
npx @mslteam/mslx-agent-skill --token=YOUR_MSLX_TOKEN

# 指定自定义 MSLX 宿主地址与 Token
npx @mslteam/mslx-agent-skill --url=http://127.0.0.1:25333/api/plugin/mslx-plugin-ai-agents/mcp --token=YOUR_MSLX_TOKEN
```

---

## 🚀 各平台 Agent 快速接入配置指南

### 1. 🌐 Google 反重力 (Google Antigravity)

#### 方式 A：加载为专用 Agent Skill
在客户端的自定义技能目录中安装本规范，或从面板查看运维指南。
```bash
# 宿主在线查看或导出
curl -fsS http://localhost:25333/api/plugin/mslx-plugin-ai-agents/mcp/skill.md
# 或通过 npm 导出
npx @mslteam/mslx-agent-skill skill
```

#### 方式 B：配置为 MCP Server
在 Antigravity 的 `mcp_servers` 中添加：
```json
{
  "mcpServers": {
    "mslx": {
      "command": "npx",
      "args": [
        "-y",
        "@mslteam/mslx-agent-skill",
        "--url=http://localhost:25333/api/plugin/mslx-plugin-ai-agents/mcp",
        "--token=YOUR_MSLX_TOKEN"
      ]
    }
  }
}
```

---

### 2. ⚡ Cursor

在工程根目录的 `.cursor/mcp.json`（或全局 Cursor 设置中的 `MCP Servers`）中添加以下配置：

```json
{
  "mcpServers": {
    "mslx-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@mslteam/mslx-agent-skill",
        "--url=http://localhost:25333/api/plugin/mslx-plugin-ai-agents/mcp",
        "--token=YOUR_MSLX_TOKEN"
      ]
    }
  }
}
```

---

### 3. 💼 Workbuddy (腾讯工友)

进入 Workbuddy 设置 -> **外部工具与 MCP 接入**：

- **接入类型**：Stdio 命令行模式
- **可执行文件 (Command)**：`npx`
- **参数 (Args)**：`-y @mslteam/mslx-agent-skill --token=YOUR_MSLX_TOKEN`

*注：若使用远程连接，也可直接选择 SSE 模式，填入 MSLX 面板展示的 SSE URL：*
`http://localhost:25333/api/plugin/mslx-plugin-ai-agents/mcp/sse?token=YOUR_MSLX_TOKEN`

---

### 4. 🧠 Qoder

在 Qoder MCP 配置文件 `~/.qoder/mcp.json` 中配置：

```json
{
  "mcpServers": {
    "mslx": {
      "command": "npx",
      "args": [
        "-y",
        "@mslteam/mslx-agent-skill",
        "--token=YOUR_MSLX_TOKEN"
      ]
    }
  }
}
```

---

### 5. 🤖 Claude Desktop

编辑 Claude Desktop 配置文件：
- **macOS**：`~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**：`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mslx-server": {
      "command": "npx",
      "args": [
        "-y",
        "@mslteam/mslx-agent-skill",
        "--token=YOUR_MSLX_TOKEN"
      ]
    }
  }
}
```

---

### 6. 🌊 Windsurf (Codeium)

在 `~/.codeium/windsurf/mcp_config.json` 中添加：

```json
{
  "mcpServers": {
    "mslx": {
      "command": "npx",
      "args": [
        "-y",
        "@mslteam/mslx-agent-skill",
        "--token=YOUR_MSLX_TOKEN"
      ]
    }
  }
}
```

---

### 7. 🇨🇳 豆包 (Doubao) / 纯文本大模型

对于不支持直接挂载 MCP 外部协议的纯文本对话大模型，可执行以下命令提取完整经过优化的 System Prompt 预设词，直接粘贴至模型设定中：

```bash
npx @mslteam/mslx-agent-skill skill
```

只有配置了 MCP 连接的客户端才能执行运维工具。纯文本对话可用这份说明提供指导。令牌应配置在客户端的连接设置中。

---

## 🛠️ MCP 工具库概览

实际工具及权限以当前节点和令牌返回的 `tools/list` 为准。

| 业务领域 | 工具名称 | 功能描述 |
| :--- | :--- | :--- |
| **实例管理** | `control_server` | 启动、停止或重启 Minecraft 服务器 |
| | `update_instance_settings` | 修改实例内存配额、绑定 Java 版本、核心文件名 |
| | `update_server_config` | 修改 `server.properties` 键值（端口、正版验证等） |
| | `query_server_status` | 查询实例在线状态、PID、CPU 与内存利用率 |
| | `query_system_metrics` | 监控宿主机与实例的系统级硬件性能指标 |
| **开服生态** | `create_mc_server` | 支持在线核心、整合包、MCDR、自定义 4 种开服模式 |
| | `query_available_server_cores` | 动态检索官方全量服务端核心（含正式版与快照版） |
| | `query_creation_status` | 轮询异步开服进度百分比与部署日志 |
| | `agree_server_eula` | 一键同意 Mojang EULA 协议解决首次开服阻塞 |
| **操作审批** | `query_operation_status` | 按 `operation_id` 查询当前令牌提交的操作 |
| **Java 管理** | `query_java_environments` | 全盘扫描系统已安装 JDK（支持强制重扫） |
| | `install_online_java` | 一键后台下载安装官方 Java 8/11/16/17/21/25 |
| **安全文件** | `list_server_files` | 列出服务器目录或子目录文件清单 |
| | `read_server_file` | 无锁读取日志与配置文件 (`FileShare.ReadWrite`) |
| | `write_server_file` | 创建或覆盖写入文件（前端交互式授权卡片保护） |
| | `delete_server_file` | 删除文件或目录（前端交互式授权卡片保护） |
| | `copy_server_file` | 复制并备份特定文件或关键数据目录 |
| | `move_server_file` | 移动或重命名文件（排障时快速禁用崩服 Mod） |
| **诊断交互** | `read_server_log` | 深度审查最新日志与崩溃分析报告 |
| | `send_server_command` | 向运行中的服务器控制台分发指令 |
| **容灾备份** | `create_server_backup` | 自动刷新磁盘缓存并生成全量世界备份压缩包 |
| | `list_server_backups` | 获取备份列表、时间戳与格式化文件大小 |
| | `restore_server_backup` | 一键回档还原（安全停机与授权卡片双重保护） |
| | `delete_server_backup` | 安全删除指定的历史备份文件 |
| **穿透自动化** | `query_frp_status` | 查看宿主 FRP 内网穿透隧道及运行状态 |
| | `control_frp_tunnel` | 开启/停止 FRP 隧道或提取最近 50 条排错日志 |
| | `manage_scheduled_tasks` | 编排每日自动备份、定时重启与 Cron 维护任务 |
| **玩家权限** | `force_kill_server` | 服务器卡死时强制强杀进程 |
| | `delete_server_instance` | 彻底移除服务器实例（删除文件受二次确认保护） |
| | `query_players` | 综合查询在线玩家、usercache 缓存与活动历史 |
| | `manage_whitelist` | 管理白名单（支持热重载，无需重启服务器） |
| | `manage_ops` | 管理 1~4 级 OP 管理员权限并同步 ops.json |
| | `manage_bans` | 管理黑名单（封禁/解封玩家与 IP 地址） |
| **资源生态** | `search_mc_resources` | 聚合搜索 Modrinth 与 CurseForge 资源生态 |
| | `query_resource_versions` | 查询模组/插件的版本兼容性与直链下载地址 |
| | `download_file_to_server` | 高速下载文件落盘至 `mods/` 或 `plugins/` |
| | `audit_client_only_mods` | 深度扫描检出 Dedicated Server 客户端独占模组 |
| | `manage_mod_plugin_state` | 启用、禁用或彻底删除指定的模组/插件 |
| | `query_python_environments` | 探测宿主机 Python 解释器与 MCDR 安装状态 |
| | `extract_archive` | 解包整合包、资源包或存档归档文件 |
| | `compress_files` | 打包指定目录或文件为 `.zip` 文件 |
| | `list_server_mods_plugins` | 快速列出已安装的模组与插件总览 |

---

## 📦 发布与维护

双包使用同一份源码和版本。`mslx-agent-skill` 是由个人 npm 账号维护的无 scope 公共包，`@mslteam/mslx-agent-skill` 发布到 MSLTeam 组织。首次发布请使用已开启 2FA、且能在 `mslteam` 组织创建公共包的 npm 账号。

```bash
npm test
npm run publish-both -- --pack ./npm-packages
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm run publish-both
```

按 npm 提示分别完成 2FA。若只剩一个包未发布，可以直接发布 `npm-packages` 中对应的 tarball。

```bash
npm view mslx-agent-skill version --registry=https://registry.npmjs.org/
npm view @mslteam/mslx-agent-skill version --registry=https://registry.npmjs.org/
```

首次发布后，在 npmjs.com 的两个包各自进入 **Settings → Trusted publishing**，选择 **GitHub Actions**。所有者填 `MSLTeam`，仓库填 `mslx-agent-skill`，工作流文件名填 `publish.yml`，Environment 留空，并允许 `npm publish`。

推送到 `master` 或 `main` 后，GitHub Actions 会比较两个 npm 包的已发布版本和源码版本，取最高稳定版本并递增一个 patch，两个包共用该版本。版本在 CI 打包时设置。首次推送后配置 Trusted Publishing，可在 Actions 中手动启动一次发布。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源协议发布。
Copyright (c) 2026 MSLTeam. All rights reserved.

### 更新连接与操作确认

旧地址中的插件 ID 已统一为 `mslx-plugin-ai-agents`，更新客户端 URL 后可继续使用原令牌。
涉及删除或覆盖时，请在对应节点的 MSLX AI 助手 → MCP → 待确认操作中审批，无需模型 API Key。
