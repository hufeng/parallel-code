# Parallel Code 架构设计

## 1. 项目概述

Parallel Code 是一个基于 Electron 的桌面应用，用于并行任务管理和 AI 辅助代码开发。技术栈为 SolidJS 前端 + Node.js 后端，支持 macOS 和 Linux。

## 2. 项目结构

```
parallel-code/
├── electron/                    # Electron 主进程
│   ├── ipc/                    # IPC 处理器
│   │   ├── channels.ts         # IPC 通道枚举定义
│   │   ├── register.ts         # 处理器注册
│   │   ├── pty.ts              # 终端(PTY)管理
│   │   ├── git.ts              # Git 操作
│   │   ├── tasks.ts            # 任务管理
│   │   ├── agents.ts           # Agent 管理
│   │   └── persistence.ts      # 持久化存储
│   ├── remote/                 # 远程访问服务器
│   │   ├── server.ts           # WebSocket/HTTP 服务器
│   │   ├── protocol.ts         # 通信协议
│   │   └── ring-buffer.ts      # 环形缓冲区
│   ├── main.ts                 # Electron 入口点
│   ├── preload.cjs             # 预加载脚本
│   └── vite.config.electron.ts
│
├── src/                        # 前端代码 (SolidJS)
│   ├── components/             # UI 组件
│   │   ├── App.tsx            # 主应用
│   │   ├── Sidebar.tsx        # 侧边栏
│   │   ├── TilingLayout.tsx   # 平铺布局
│   │   ├── TaskPanel.tsx      # 任务面板
│   │   ├── TerminalView.tsx   # 终端视图
│   │   ├── NewTaskDialog.tsx  # 新建任务对话框
│   │   └── DiffViewerDialog.tsx # Diff 查看器
│   ├── store/                  # 状态管理
│   │   ├── core.ts             # 核心状态定义
│   │   ├── tasks.ts            # 任务操作
│   │   ├── agents.ts           # Agent 操作
│   │   ├── projects.ts         # 项目管理
│   │   ├── navigation.ts       # 导航
│   │   ├── focus.ts            # 焦点状态
│   │   ├── ui.ts               # UI 状态
│   │   ├── taskStatus.ts       # 任务状态轮询
│   │   ├── persistence.ts       # 持久化
│   │   ├── remote.ts           # 远程访问
│   │   └── notification.ts      # 通知
│   ├── lib/                    # 工具库
│   │   ├── ipc.ts              # IPC 封装
│   │   ├── window.ts           # 窗口管理
│   │   ├── dialog.ts           # 对话框
│   │   └── ...
│   ├── ipc/                    # IPC 类型定义
│   │   └── types.ts
│   └── remote/                 # 远程客户端
│
├── build/                      # 构建资源
├── dist/                       # 前端构建输出
├── dist-electron/              # Electron 构建输出
└── dist-remote/                # 远程客户端构建输出
```

## 3. 前端架构

### 3.1 技术栈

| 依赖                 | 版本    | 用途      |
| -------------------- | ------- | --------- |
| solid-js             | ^1.9.11 | 前端框架  |
| vite                 | ^7.3.1  | 构建工具  |
| @xterm/xterm         | ^6.0.0  | 终端 UI   |
| @git-diff-view/solid | ^0.0.12 | Diff 视图 |

### 3.2 组件架构

前端采用 **SolidJS 函数式组件**，组件间通过 props 和 store 进行数据传递。

```
App.tsx
  ├── Sidebar                    # 项目列表侧边栏
  ├── TilingLayout               # 任务平铺布局容器
  │     └── TaskPanel            # 单个任务面板
  │           ├── TerminalView   # 终端视图 (xterm.js)
  │           └── Toolbar        # 任务工具栏
  ├── NewTaskDialog              # 新建任务对话框
  └── DiffViewerDialog           # Git Diff 查看器
```

### 3.3 状态管理

使用 **SolidJS Store** (`solid-js/store`) 管理全局状态：

```typescript
// src/store/core.ts
export const [store, setStore] = createStore<AppStore>({
  projects: [],
  tasks: {},
  agents: {},
  terminals: {},
  activeTaskId: null,
  activeAgentId: null,
});
```

Store 模块化设计（barrel file 模式）：

- `core.ts` - 核心状态定义
- `tasks.ts` - 任务 CRUD 操作
- `agents.ts` - Agent 管理
- `projects.ts` - 项目管理
- `navigation.ts` - 导航/焦点管理
- `ui.ts` - UI 状态（主题、字体等）
- `persistence.ts` - 状态持久化
- `remote.ts` - 远程访问

### 3.4 IPC 通信层

前端通过 `src/lib/ipc.ts` 与主进程通信：

```typescript
// 通用调用
export async function invoke<T>(cmd: IPC, args?: Record<string, unknown>): Promise<T> {
  const safeArgs = args ? JSON.parse(JSON.stringify(args)) : undefined;
  return window.electron.ipcRenderer.invoke(cmd, safeArgs) as Promise<T>;
}

// PTY 输出流（使用 Channel 类）
export class Channel<T> {
  // 用于接收 PTY 输出流
}
```

## 4. 后端架构

### 4.1 主进程入口

`electron/main.ts` 负责：

- 创建 BrowserWindow (1400x900)
- 注册所有 IPC 处理器
- 处理 PATH 环境变量
- 窗口事件管理

```typescript
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: process.platform === 'darwin',
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  registerAllHandlers(mainWindow);
}
```

### 4.2 IPC 处理器

| 处理器      | 文件               | 功能                                            |
| ----------- | ------------------ | ----------------------------------------------- |
| PTY         | `pty.ts`           | 终端创建、输入、调整大小、暂停/恢复、终止       |
| Git         | `git.ts`           | 变更文件、Diff、Merge、Push、Rebase、工作树管理 |
| Tasks       | `tasks.ts`         | 任务创建、删除                                  |
| Agents      | `agents.ts`        | Agent 管理                                      |
| Persistence | `persistence.ts`   | 状态持久化                                      |
| Remote      | `remote/server.ts` | 远程服务器管理                                  |

### 4.3 PTY 管理

使用 `node-pty` 创建伪终端：

```typescript
// electron/ipc/pty.ts
const sessions = new Map<string, PtySession>();

export function spawnAgent(win: BrowserWindow, args: {...}): void {
  const proc = pty.spawn(command, args.args, {
    name: 'xterm-256color',
    cols: args.cols,
    rows: args.rows,
    cwd,
    env: spawnEnv,
  });
}
```

**性能优化**：

- 批处理输出流：64KB 数据或 8ms 间隔推送一次
- 维护滚动缓冲区：8KB 大小

**安全措施**：

- 黑名单环境变量（PATH, HOME, USER, LD_PRELOAD 等）
- 命令验证（禁止 shell 元字符）
- 路径验证（绝对路径、防目录遍历）

### 4.4 Git 操作

`electron/ipc/git.ts` 提供：

- 变更文件列表
- 文件 Diff
- Merge/Push/Rebase 操作
- 工作树（Worktree）管理

**优化策略**：

- 主分支缓存（60s）
- merge-base 缓存（30s）
- 工作树操作串行化（锁机制）
- 支持 symlink 共享 node_modules

### 4.5 预加载脚本

`electron/preload.cjs` 使用 contextBridge 暴露安全的 IPC 接口：

```javascript
const ALLOWED_CHANNELS = new Set([...]);  // 白名单

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (!isAllowedChannel(channel)) throw new Error(...);
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, listener) => { ... },
  },
});
```

## 5. 前后端通信

### 5.1 IPC 通信模式

```
Renderer (Frontend)              Main Process (Backend)
      |                                |
      | --- invoke(IPC.SpawnAgent) --> |
      |                                | 启动 node-pty
      |                                |
      | <-- Channel 接收 PTY 输出 --- |
      |                                |
      | --- invoke(IPC.WriteToAgent) >|
      |                                | 写入 PTY
```

### 5.2 IPC 通道分类

**请求-响应模式**（`ipcMain.handle`）：

- Agent 生命周期管理
- Git 操作
- 文件系统操作
- 窗口管理
- 持久化

**事件推送模式**（`webContents.send`）：

- PTY 输出流（通过 Channel）
- 窗口焦点/大小变化事件

### 5.3 IPC 通道定义

通道枚举定义在 `electron/ipc/channels.ts`，由主进程、预加载、前端三方共享：

```typescript
export enum IPC {
  SpawnAgent = 'spawn-agent',
  WriteToAgent = 'write-to-agent',
  ResizeAgent = 'resize-agent',
  KillAgent = 'kill-agent',
  GetChangedFiles = 'get-changed-files',
  GetFileDiff = 'get-file-diff',
  // ...
}
```

## 6. 远程访问架构

### 6.1 系统架构

```
Mobile Device              Remote Server              Main App
    |                           |                       |
    | ---- WebSocket (token) -> |                       |
    |                           | <-- subscribeToAgent -|
    | <--- PTY Output (base64)- |                       |
    |                           |                       |
    | --- Input/Resize/Kill --> | ---> writeToAgent    |
    |                           |     resizeAgent       |
    |                           |     killAgent         |
```

### 6.2 WebSocket 消息类型

| 类型      | 方向          | 说明                  |
| --------- | ------------- | --------------------- |
| subscribe | 客户端→服务器 | 订阅终端输出          |
| output    | 服务器→客户端 | Base64 编码的终端输出 |
| input     | 客户端→服务器 | 终端输入              |
| resize    | 客户端→服务器 | 调整终端大小          |
| kill      | 客户端→服务器 | 终止会话              |

### 6.3 技术实现

- 服务器：`ws` 库实现 WebSocket
- 认证：Token 验证
- 数据传输：Base64 编码二进制数据
- 二维码：使用 `qrcode` 库生成连接二维码

## 7. 模块依赖关系

### 7.1 前端依赖

```
App.tsx
  ├── store/store.ts (barrel)
  │     ├── core.ts
  │     ├── tasks.ts
  │     ├── agents.ts
  │     ├── projects.ts
  │     └── ...
  │
  ├── lib/ipc.ts
  │     └── electron/ipc/channels.ts
  │
  └── components/*
```

### 7.2 后端依赖

```
main.ts
  ├── ipc/register.ts
  │     ├── ipc/pty.ts
  │     │     └── remote/ring-buffer.ts
  │     ├── ipc/git.ts
  │     ├── ipc/tasks.ts
  │     ├── ipc/agents.ts
  │     ├── ipc/persistence.ts
  │     └── remote/server.ts
  │
  └── preload.cjs
```

## 8. 构建配置

### 8.1 前端构建 (Vite)

- 输出：`dist/`
- JSX：preserve 模式
- 模块：ESNext

### 8.2 Electron 构建

- 输出：`dist-electron/`
- 模块：NodeNext
- 编译：TypeScript

### 8.3 远程客户端构建

- 输出：`dist-remote/`
- 独立 Vite 配置

## 9. 安全设计

1. **Context Isolation**: 启用 contextIsolation，隔离前端与 Node.js
2. **Node Integration**: 禁用 nodeIntegration
3. **Preload 白名单**: 只暴露必要的 IPC 通道
4. **输入验证**: PTY 命令和路径验证
5. **环境变量黑名单**: 过滤敏感环境变量

## 10. 架构总结

| 方面       | 设计选择                           |
| ---------- | ---------------------------------- |
| 状态管理   | SolidJS Store（按功能模块化）      |
| 通信方式   | IPC（请求-响应 + 事件推送）        |
| 终端模拟   | node-pty + xterm.js                |
| Git 工作流 | 基于 git worktree 任务隔离         |
| 远程访问   | WebSocket 服务器 + Token 认证      |
| 安全       | Context isolation + Preload 白名单 |
| 平台       | macOS + Linux（无 Windows）        |
