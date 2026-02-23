# Agent 管理功能 SPEC

## 1. 概述

**功能名称**: Agent 管理
**功能描述**: 用户通过前端 UI 灵活配置和管理 AI Agent 列表
**优先级**: 高

## 2. 背景

当前 Agent（Claude Code、Codex CLI、Gemini CLI）是硬编码在代码中的，无法扩展。用户需要支持更多本地 CLI 工具，如 claude-kimi、claude-minimax、opencode 等。

## 3. 需求

### 3.1 存储方式

- 独立配置文件：`~/.config/parallel-code/settings.json`
- JSON 格式存储，使用 `{ "agents": [...] }` 结构，便于将来扩展其他配置
- 首次运行时，使用内置默认 Agent 列表作为初始值

### 3.1.1 默认 Agent 列表

首次运行或 settings.json 不存在时，使用以下默认列表：

| id          | name        | command  | resume_args     | skip_permissions_args          | description                 |
| ----------- | ----------- | -------- | --------------- | ------------------------------ | --------------------------- |
| claude-code | Claude Code | claude   | --continue      | --dangerously-skip-permissions | Anthropic's Claude Code CLI |
| codex       | Codex CLI   | codex    | resume --last   | --full-auto                    | OpenAI's Codex CLI          |
| gemini      | Gemini CLI  | gemini   | --resume latest | --yolo                         | Google's Gemini CLI         |
| opencode    | OpenCode    | opencode | continue        | --yes                          | OpenCode CLI                |

所有默认 Agent 默认启用（enabled: true）。

### 3.2 Agent 字段（完整）

| 字段                  | 类型     | 必填 | 说明                       |
| --------------------- | -------- | ---- | -------------------------- |
| id                    | string   | 是   | 唯一标识，如 `claude-kimi` |
| name                  | string   | 是   | 显示名称，如 "Claude Kimi" |
| command               | string   | 是   | 命令行，如 `claude`        |
| args                  | string[] | 否   | 启动参数                   |
| resume_args           | string[] | 否   | 恢复参数                   |
| skip_permissions_args | string[] | 否   | 跳过确认参数               |
| description           | string   | 否   | 描述信息                   |
| enabled               | boolean  | 是   | 是否启用                   |
| base_id               | string   | 否   | 继承的 Agent ID（可选）    |

### 3.2.1 继承机制

用户可选择"基于已有 Agent 创建"，系统会自动填充该 Agent 的以下字段：

- `resume_args`
- `skip_permissions_args`
- `description`

用户只需修改：

- `id`（如 `claude-kimi`）
- `name`（如 "Claude Kimi"）
- `command`（如 `claude-kimi`）
- `args`（如有自定义参数）

存储时，继承字段与基 Agent 相同，如有修改则单独存储（覆盖）。

### 3.3 UI 功能

- **添加 Agent**: 弹出表单填写 Agent 配置
- **编辑 Agent**: 修改已有 Agent 配置
- **删除 Agent**: 确认后移除
- **启用/禁用**: 开关控制是否在新建任务中显示

## 4. 架构设计

### 4.1 后端模块

#### 4.1.1 Agent 读取

```
文件: electron/ipc/agents.ts
函数: loadAgentsFromFile()
  - 读取 ~/.config/parallel-code/settings.json
  - 不存在或解析失败则返回内置默认列表
  - 解析 JSON 并返回 AgentDef[]
```

#### 4.1.2 Agent 保存

```
文件: electron/ipc/agents.ts
函数: saveAgentsToFile(agents: AgentDef[])
  - 写入 settings.json
  - 原子写入（临时文件 + rename）
```

#### 4.1.3 IPC 通道

```
文件: electron/ipc/channels.ts
新增:
  - SaveAgents = 'save_agents'

文件: electron/ipc/register.ts
注册:
  - IPC.SaveAgents -> saveAgents()
```

### 4.2 前端模块

#### 4.2.1 Store 扩展

```
文件: src/store/agents.ts
新增:
  - saveAgents(agents: AgentDef[]): Promise<void>
```

#### 4.2.2 UI Store

```
文件: src/store/ui.ts
新增:
  - showAgentsDialog: boolean
  - editingAgent: AgentDef | null
```

#### 4.2.3 Agent 管理对话框

```
新建: src/components/AgentsDialog.tsx
组件结构:
  ├── Header (标题 + 关闭按钮)
  ├── AgentList
  │     └── AgentItem (循环)
  │           ├── 开关 (启用/禁用)
  │           ├── 信息 (name, command, description)
  │           ├── 编辑按钮
  │           └── 删除按钮
  ├── AddButton
  └── AgentFormDialog (条件渲染)
        ├── Name 输入
        ├── Command 输入
        ├── Args 输入
        ├── Resume Args 输入
        ├── Skip Permissions Args 输入
        ├── Description 输入
        ├── Cancel 按钮
        └── Save 按钮
```

### 4.3 入口位置

在设置对话框或侧边栏添加 "Manage Agents" 入口。

## 5. 数据流

```
用户点击 "Manage Agents"
    ↓
打开 AgentsDialog
    ↓
调用 loadAgents() 获取列表
    ↓
用户添加/编辑/删除
    ↓
调用 saveAgents() 保存
    ↓
IPC -> Main Process
    ↓
写入 settings.json
    ↓
返回成功
    ↓
更新前端 store
```

## 6. 交互设计

### 6.1 Agent 列表项

```
┌─────────────────────────────────────────────────────┐
│ [开关] Claude Kimi                    [编辑] [删除] │
│       claude-kimi - Anthropic CLI (kimi variant)   │
└─────────────────────────────────────────────────────┘
```

### 6.2 添加/编辑表单

```
┌────────────────────────────────────────┐
│ Add Agent / Edit Agent                 │
├────────────────────────────────────────┤
│ Based on (optional)                    │
│ [Select Agent v]  (继承配置)           │
│                                        │
│ Name *                                 │
│ [___________________________________]  │
│                                        │
│ Command *                              │
│ [___________________________________]  │
│                                        │
│ Args (comma separated)                 │
│ [___________________________________]  │
│                                        │
│ Resume Args                            │
│ [___________________________________]  │
│                                        │
│ Skip Permissions Args                  │
│ [___________________________________]  │
│                                        │
│ Description                            │
│ [___________________________________]  │
│                                        │
│ [Cancel]              [Save]           │
└────────────────────────────────────────┘
```

选择"Based on"后：

- 如果是新建：自动填充所选 Agent 的 resume_args、skip_permissions_args、description
- 如果是编辑：显示已选择的基 Agent

## 7. 边界情况

| 场景                   | 处理                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| settings.json 不存在   | 返回内置默认 Agent 列表                                                                             |
| settings.json 格式错误 | 记录错误，返回内置默认 Agent 列表                                                                   |
| command 为空           | 表单验证不通过                                                                                      |
| id 重复                | 允许（用户输入重复 id 不会导致错误）                                                                |
| 删除所有 Agent         | 允许（不推荐），新建任务时提示无 Agent 可用                                                         |
| Shell 函数作为 command | node-pty 使用 execvp，只能执行二进制文件，无法执行 shell 函数。解决方案：创建包装脚本并建立符号链接 |

## 7.1 Shell 函数兼容说明

由于 node-pty 使用 `execvp` 执行命令，只能运行二进制可执行文件，无法执行 shell 函数（如 zsh function）。

### 解决方案：创建包装脚本

1. 创建包装脚本 `~/.config/zsh/functions/claude-kimi.sh`：

```bash
#!/bin/bash
# 加载配置并执行 claude 命令
exec command claude "$@"
```

2. 创建符号链接到 `/usr/local/bin/`：

```bash
ln -sf ~/.config/zsh/functions/claude-kimi.sh /usr/local/bin/claude-kimi
```

### Token 获取问题

如果 Agent 需要从 KeePassXC 获取 API Token，注意：

- KeePassXC 需要在非交互式环境下 unlock
- 建议在配置文件中直接填写 API Token，或确保 KeePassXC 数据库已 unlock

## 8. 验证测试用例

| 用例       | 步骤               | 预期结果            |
| ---------- | ------------------ | ------------------- |
| 初始状态   | 首次运行           | 显示 4 个默认 Agent |
| 添加 Agent | 填写表单保存       | 列表显示新 Agent    |
| 编辑 Agent | 修改名称保存       | 列表更新            |
| 禁用 Agent | 关闭开关           | 新建任务中不显示    |
| 删除 Agent | 点击删除确认       | 列表移除            |
| 持久化     | 重启应用           | 用户自定义配置保留  |
| 重置为默认 | 删除 settings.json | 恢复 4 个默认 Agent |
| 新建任务   | 使用自定义 Agent   | Agent 正常运行      |

## 9. 实现 Todo

### Phase 1: 后端改动

- [x] **1.1** 修改 `electron/ipc/agents.ts`
  - [x] 添加 `DEFAULT_AGENTS` 常量（4 个默认 Agent）
  - [x] 添加 `getAgentsPath()` 获取配置文件路径
  - [x] 添加 `loadAgentsFromFile()` 读取 settings.json
  - [x] 不存在或解析失败时返回 DEFAULT_AGENTS
  - [x] 添加 `saveAgentsToFile(agents)` 写入 settings.json
  - [x] 修改 `listAgents()` 调用 loadAgentsFromFile()

- [x] **1.2** 修改 `electron/ipc/channels.ts`
  - [x] 添加 `SaveAgents = 'save_agents'` 枚举值

- [x] **1.3** 修改 `electron/ipc/agents.ts`
  - [x] 导出 `saveAgents(agents: AgentDef[])` 函数

- [x] **1.4** 修改 `electron/ipc/register.ts`
  - [x] 注册 `IPC.SaveAgents` 处理器

### Phase 2: 前端 Store

- [x] **2.1** 修改 `src/ipc/types.ts`
  - [x] 在 `AgentDef` 接口添加 `enabled?: boolean` 字段
  - [x] 添加 `base_id?: string` 字段

- [x] **2.2** 修改 `src/store/agents.ts`
  - [x] 导入新增的 IPC 通道
  - [x] 添加 `saveAgents(agents: AgentDef[]): Promise<void>` 函数

- [x] **2.3** 修改 `src/store/ui.ts` 或新建 `src/store/agentDialog.ts`
  - [x] 添加 `showAgentsDialog: boolean` 状态
  - [x] 添加 `editingAgent: AgentDef | null` 状态（在组件内部实现）

### Phase 3: UI 组件

- [x] **3.1** 新建 `src/components/AgentsDialog.tsx`
  - [x] 组件结构：Dialog 包裹
  - [x] 状态：agents 列表、是否显示表单、正在编辑的 agent
  - [x] AgentList 渲染：循环显示 AgentItem
  - [x] AgentItem：开关、名称、描述、编辑按钮、删除按钮
  - [x] AgentFormDialog：基于继承的表单字段
  - [x] 基于选择器：下拉选择基 Agent，自动填充字段

- [x] **3.2** 修改 `src/components/NewTaskDialog.tsx`
  - [x] 只显示 enabled: true 的 Agent

- [x] **3.3** 添加入口（待定位置：设置对话框或其他）
  - [x] 添加 "Manage Agents" 按钮/链接
  - [x] 点击打开 AgentsDialog

### Phase 4: 集成测试

- [x] **4.1** 运行 `npm run dev` 启动应用
- [x] **4.2** 打开 Agent 管理界面
- [x] **4.3** 验证初始状态显示 4 个默认 Agent (Claude Code, Codex, Gemini, OpenCode)
- [x] **4.4** 测试添加新 Agent（基于 Claude Code）
- [x] **4.5** 测试编辑 Agent
- [x] **4.6** 测试启用/禁用功能
- [x] **4.7** 测试删除 Agent
- [x] **4.8** 重启应用验证持久化
- [x] **4.9** 新建任务使用自定义 Agent 验证正常工作

## 10. 构建配置说明

### 10.1 构建命令

```bash
npm run build
```

执行流程：

1. `npm run build:frontend` - 构建前端 (Vite)
2. `npm run build:remote` - 构建远程客户端 (Vite)
3. `npm run compile` - 编译 TypeScript (Electron)
4. `electron-builder` - 打包应用

### 10.2 构建产物

| 平台  | 产物            | 输出目录   |
| ----- | --------------- | ---------- |
| macOS | .dmg            | `release/` |
| Linux | .AppImage, .deb | `release/` |

### 10.3 构建配置（package.json）

```json
{
  "build": {
    "appId": "com.parallel-code.app",
    "productName": "Parallel Code",
    "directories": {
      "buildResources": "build",
      "output": "release"
    },
    "files": ["dist/**/*", "dist-electron/**/*", "dist-remote/**/*", "electron/preload.cjs"],
    "asarUnpack": ["**/node-pty/**"],
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Development"
    },
    "mac": {
      "target": "dmg",
      "category": "public.app-category.developer-tools"
    }
  }
}
```

### 10.4 发布命令

```bash
npm run release
```

执行 `npm version patch` + git push，会自动构建并打 tag。
