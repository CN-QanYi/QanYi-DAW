# QanYi DAW

[English](README.md) | [中文](README.zh-CN.md)

---

QanYi DAW 是一款使用 Web 技术构建的数字音频工作站（DAW）。项目基于 Vite，目标是实现“多音轨时间线 + 片段编排 + 混音器”的基础工作流。

## 功能特性

- 支持导入音频文件（也支持拖放导入）
- 多音轨时间线编辑（将片段放置到指定音轨与时间）
- 传输控制：播放 / 暂停 / 停止
- 基础混音器界面（含 Master 通道）
- BPM 控制与时间显示

> 提示：浏览器端音频播放通常需要用户首次点击/交互后才能启动 AudioContext。

## 快速开始

### 环境要求

- Node.js（建议使用较新的 LTS 版本）

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
npm run dev
```

Vite 开发服务器默认地址为 `http://localhost:5173`，并已配置为自动打开浏览器。

### 构建

```bash
npm run build
```

### 预览构建产物

```bash
npm run preview
```

## 项目结构

- `index.html` — 应用壳
- `src/main.js` — 主入口与组件协调
- `src/core/` — 音频引擎与核心模型
  - `AudioEngine.js` — 播放与传输控制
  - `Track.js` / `AudioClip.js` — 核心实体
- `src/ui/` — UI 组件（Toolbar/Timeline/Mixer/TrackList/Waveform）
- `src/styles/` — 全局样式

## 路线图（想法）

- 撤销/重做
- 吸附网格与节拍对齐
- 音量自动化与轨道效果
- 导出/Bounce 到 WAV
