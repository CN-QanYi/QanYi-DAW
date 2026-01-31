## QanYi DAW

[English](README.md) | [中文](README.zh-CN.md)

---

QanYi DAW is a digital audio workstation built with Web technologies. It’s a Vite-powered frontend app focused on arranging audio clips on a timeline with track/mixer-style UI.

#### Features

- Import audio files (drag & drop supported)
- Multi-track timeline editing (place clips on tracks over time)
- Transport controls: play / pause / stop
- Basic mixer UI with master channel
- BPM control and time display

> Note: Browser audio playback typically requires a user gesture (click/tap) before the AudioContext can start.

#### Getting Started

##### Prerequisites

- Node.js (recommended: a recent LTS)

##### Install

```bash
npm install
```

##### Run (dev)

```bash
npm run dev
```

Vite dev server defaults to `http://localhost:5173` and is configured to open the browser automatically.

##### Build

```bash
npm run build
```

##### Preview production build

```bash
npm run preview
```

#### Project Structure

- `index.html` — App shell
- `src/main.js` — App entry and orchestration
- `src/core/` — Audio engine & domain models
  - `AudioEngine.js` — playback/transport
  - `Track.js` / `AudioClip.js` — core entities
- `src/ui/` — UI components (Toolbar/Timeline/Mixer/TrackList/Waveform)
- `src/styles/` — global styles

#### Roadmap (ideas)

- Undo/redo
- Snap-to-grid and tempo-aware timeline
- Volume automation and per-track effects
- Export/bounce to WAV
