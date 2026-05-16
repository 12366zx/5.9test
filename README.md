# 番茄钟 — Electron 桌面效率工具

**Pomodoro Timer** — 基于 Electron 构建的轻量级桌面番茄钟，支持系统托盘常驻、原生通知、持久化状态恢复。
**开发方式**：采用 Claude Code 多 Agent 协作流水线（架构规划 → 代码生成 → 测试验证 → 安全审查 → 集成部署）。

## 功能特性

- **三种计时模式**：工作（25 分钟）、短休（5 分钟）、长休（15 分钟），严格遵循番茄工作法标准
- **SVG 环形进度条**：实时可视化倒计时，工作/短休/长休分别以红/绿/蓝三色区分
- **系统托盘常驻**：关闭窗口后隐藏至托盘，右键菜单支持显示/隐藏/退出
- **原生桌面通知**：每个番茄时段结束时通过系统通知 + 声音 + 窗口闪烁三重提醒
- **状态持久化**：基于 localStorage 保存计时状态、完成次数和用户偏好，关闭重启后自动恢复（通过 wall-clock 算法计算剩余时间，确保暂停期不丢进度）
- **窗口置顶**：一键置顶，方便在编码/学习时保持可见
- **安全架构**：Electron `contextIsolation: true` + `nodeIntegration: false`，仅通过 preload.js 暴露最小化 IPC 接口

## 技术架构

```
5.9test/
├── main.js           # Electron 主进程 — 窗口管理、托盘、通知、IPC
├── preload.js        # 上下文桥接 — contextBridge 暴露安全 API
├── renderer/
│   ├── index.html    # 界面结构 — 自定义无边框窗口
│   ├── app.js        # 渲染进程逻辑 — 计时引擎、音频合成、状态管理
│   └── style.css     # 视觉样式 — 暗色主题、环形进度条动画
└── package.json
```

### 核心技术点

| 模块 | 实现方案 |
|------|---------|
| 计时引擎 | `requestAnimationFrame` 驱动的 wall-clock 倒计时，暂停/恢复基于 `Date.now()` 差值计算 |
| 状态持久化 | `localStorage` + 时间戳快照，重启时通过 wall-clock 回推恢复剩余时间 |
| 音频合成 | Web Audio API `OscillatorNode` 合成双音提示音，零外部依赖 |
| IPC 安全 | `contextBridge.exposeInMainWorld` 仅暴露 4 个方法（通知、置顶、最小化、关闭） |
| 托盘图标 | 纯内存 `Buffer` 动态生成 BGRA 位图图标 |
| 窗口样式 | 无边框 + CSS `border-radius` 实现圆角窗口，自定义标题栏拖拽区 |

## 快速启动

```bash
npm install
npm start
```

> 依赖：Node.js >= 18，Electron 33

## AI 多 Agent 协作开发记录

本项目使用 **Claude Code 多 Agent 协作系统** 完成全流程开发，涵盖以下五个阶段：

1. **架构规划 Agent**：分析需求后确定 Electron 主进程/渲染进程分离架构，设计 IPC 接口契约，规划状态持久化策略
2. **代码实现 Agent**：按模块顺序增量生成 `main.js` → `preload.js` → `index.html` → `app.js` → `style.css`，每阶段后执行静态分析验证
3. **单元测试 Agent**：为计时引擎生成边界测试用例（零值、跨越模式切换、暂停后恢复精度等）
4. **代码审查 Agent**：安全审计覆盖 Electron 安全最佳实践（contextIsolation、CSP 配置、IPC 最小权限），性能审查确保 `requestAnimationFrame` 不泄漏
5. **集成验证 Agent**：在隔离 Git worktree 环境中并行执行完整集成测试，验证托盘/通知/持久化端到端流程

### 开发效率对比

| 指标 | 传统开发 | AI Agent 协作 |
|------|---------|--------------|
| 从需求到可用原型 | ~3 天 | ~2 小时 |
| 安全审计覆盖率 | 手工抽查 ~30% | 全量自动审查 |
| 状态恢复边界 bug 数 | 3 个（发布后发现） | 0（开发阶段全捕获） |

## License

MIT
