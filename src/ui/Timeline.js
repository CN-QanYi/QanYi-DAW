/**
 * Timeline - 时间线编辑区组件
 * 负责时间刻度尺、播放头、音频片段显示和编辑
 */
import { audioEngine } from '../core/AudioEngine.js';
import { AudioClip } from '../core/AudioClip.js';
import { createWaveformForClip } from './Waveform.js';

export class Timeline {
    constructor() {
        this.container = document.getElementById('timeline-container');
        this.timeRuler = document.getElementById('time-ruler');
        this.rulerCanvas = document.getElementById('ruler-canvas');
        this.playhead = document.getElementById('playhead');
        this.tracksContainer = document.getElementById('timeline-tracks');

        // 配置
        this.pixelsPerSecond = 50; // 缩放级别
        this.snapToGrid = true;
        this.gridSize = 0.25; // 四分之一拍

        // 状态
        this.trackElements = new Map();
        this.clipElements = new Map();
        this.clipWaveforms = new Map();
        this.selectedClip = null;
        this.draggingClip = null;
        this.dragStartX = 0;
        this.dragStartTime = 0;

        // 事件回调
        this.onClipSelect = null;
        this.onClipMove = null;

        this.init();
    }

    /**
     * 初始化时间线
     */
    init() {
        // 设置 canvas 尺寸
        this.resizeRuler();

        // 窗口调整大小时重新绘制
        window.addEventListener('resize', () => {
            this.resizeRuler();
            this.drawRuler();
        });

        // 点击时间尺定位播放头
        this.timeRuler.addEventListener('click', (e) => {
            const rect = this.timeRuler.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = x / this.pixelsPerSecond;
            audioEngine.seekTo(time);
            this.updatePlayhead(time);
        });

        // 滚轮缩放
        this.container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                this.setZoom(this.pixelsPerSecond * zoomFactor);
            }
        }, { passive: false });

        // 音频引擎时间更新回调
        const originalTimeUpdate = audioEngine.onTimeUpdate;
        audioEngine.onTimeUpdate = (time) => {
            if (originalTimeUpdate) originalTimeUpdate(time);
            this.updatePlayhead(time);
        };

        // 初始绘制
        this.drawRuler();
    }

    /**
     * 调整时间尺 canvas 尺寸
     */
    resizeRuler() {
        const rect = this.timeRuler.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.rulerCanvas.width = rect.width * dpr;
        this.rulerCanvas.height = rect.height * dpr;

        this.rulerCanvas.style.width = `${rect.width}px`;
        this.rulerCanvas.style.height = `${rect.height}px`;

        const ctx = this.rulerCanvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }

    /**
     * 绘制时间刻度尺
     */
    drawRuler() {
        const canvas = this.rulerCanvas;
        const ctx = canvas.getContext('2d');
        const rect = this.timeRuler.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // 清除
        ctx.clearRect(0, 0, width, height);

        // 计算每小节的像素数
        const beatsPerBar = 4;
        const secondsPerBeat = 60 / audioEngine.tempo;
        const secondsPerBar = secondsPerBeat * beatsPerBar;
        const pixelsPerBar = secondsPerBar * this.pixelsPerSecond;
        const pixelsPerBeat = secondsPerBeat * this.pixelsPerSecond;

        // 绘制刻度
        ctx.fillStyle = '#b0b0c0';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';

        const totalBars = Math.ceil(width / pixelsPerBar) + 1;

        for (let bar = 0; bar < totalBars; bar++) {
            const x = bar * pixelsPerBar;

            // 小节标记
            ctx.fillStyle = '#b0b0c0';
            ctx.fillText(`${bar + 1}`, x + 12, 14);

            // 小节线
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 18);
            ctx.lineTo(x, height);
            ctx.stroke();

            // 拍子线
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            for (let beat = 1; beat < beatsPerBar; beat++) {
                const beatX = x + beat * pixelsPerBeat;
                ctx.beginPath();
                ctx.moveTo(beatX, 22);
                ctx.lineTo(beatX, height);
                ctx.stroke();
            }
        }
    }

    /**
     * 更新播放头位置
     * @param {number} time - 当前时间（秒）
     */
    updatePlayhead(time) {
        const x = time * this.pixelsPerSecond;
        this.playhead.style.left = `${x}px`;
    }

    /**
     * 设置缩放级别
     * @param {number} pixelsPerSecond - 每秒像素数
     */
    setZoom(pixelsPerSecond) {
        this.pixelsPerSecond = Math.max(10, Math.min(200, pixelsPerSecond));
        this.drawRuler();
        this.updateAllClips();
    }

    /**
     * 添加轨道到时间线
     * @param {Track} track - 音轨对象
     */
    addTrack(track) {
        const trackEl = document.createElement('div');
        trackEl.className = 'timeline-track';
        trackEl.dataset.trackId = track.id;

        // 外部文件拖放处理
        trackEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        trackEl.addEventListener('drop', (e) => {
            e.preventDefault();
            // 处理从外部拖入的文件
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
            if (files.length > 0) {
                const rect = trackEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const time = this.snapToGrid ? this.snapTime(x / this.pixelsPerSecond) : x / this.pixelsPerSecond;

                // 触发文件导入事件
                if (this.onFileDrop) {
                    this.onFileDrop(files, track.id, time);
                }
            }
        });

        // 轨道右键菜单（空白区域）
        trackEl.addEventListener('contextmenu', (e) => {
            // 只有点击空白区域才显示轨道菜单
            if ((e.target === trackEl || e.target.closest('.timeline-track') === trackEl) && !e.target.closest('.audio-clip')) {
                e.preventDefault();
                e.stopPropagation();
                this.showTrackContextMenu(e.clientX, e.clientY, track, e);
            }
        });

        this.tracksContainer.appendChild(trackEl);
        this.trackElements.set(track.id, trackEl);
    }

    /**
     * 移除轨道
     * @param {string} trackId - 音轨 ID
     */
    removeTrack(trackId) {
        const track = audioEngine.tracks.find(t => t.id === trackId);
        const clipIds = track?.clips?.map(clip => clip.id) ?? [];
        clipIds.forEach((clipId) => {
            const clipEl = this.clipElements.get(clipId);
            if (clipEl) {
                clipEl.remove();
                this.clipElements.delete(clipId);
            }

            const waveform = this.clipWaveforms.get(clipId);
            if (waveform) {
                if (waveform.canvas && waveform.canvas.parentNode) {
                    waveform.canvas.parentNode.removeChild(waveform.canvas);
                }
                waveform.destroy();
                this.clipWaveforms.delete(clipId);
            }
        });

        const trackEl = this.trackElements.get(trackId);
        if (trackEl) {
            trackEl.remove();
            this.trackElements.delete(trackId);
        }
    }

    /**
     * 添加音频片段到时间线
     * @param {AudioClip} clip - 音频片段
     * @param {string} trackId - 音轨 ID
     */
    addClip(clip, trackId) {
        const trackEl = this.trackElements.get(trackId);
        if (!trackEl) return;

        const clipEl = document.createElement('div');
        clipEl.className = 'audio-clip';
        clipEl.dataset.clipId = clip.id;

        // 设置位置和宽度
        this.updateClipPosition(clip, clipEl);

        // 片段头部
        const header = document.createElement('div');
        header.className = 'audio-clip-header';

        const iconSpan = document.createElement('span');
        iconSpan.textContent = '🎵';
        header.appendChild(iconSpan);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'clip-name';
        nameSpan.textContent = clip.name;
        header.appendChild(nameSpan);

        // 双击编辑名称
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startEditClipName(clip, nameSpan);
        });

        clipEl.appendChild(header);

        // 波形容器
        const waveformContainer = document.createElement('div');
        waveformContainer.style.height = 'calc(100% - 24px)';
        waveformContainer.style.position = 'relative';
        clipEl.appendChild(waveformContainer);

        // 创建波形
        setTimeout(() => {
            const waveform = createWaveformForClip(clip, waveformContainer, {
                fillColor: 'rgba(99, 102, 241, 0.6)',
                lineColor: '#a5b4fc'
            });
            this.clipWaveforms.set(clip.id, waveform);
        }, 0);

        // 点击选择
        clipEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectClip(clip);
        });

        // 右键菜单
        clipEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectClip(clip);
            this.showContextMenu(e.clientX, e.clientY, clip);
        });

        // 拖动移动（支持跨轨道）
        clipEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            this.draggingClip = clip;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.dragStartTime = clip.startTime;
            this.dragStartTrackId = clip.trackId;

            clipEl.style.cursor = 'grabbing';
            clipEl.style.zIndex = '100';
            clipEl.style.pointerEvents = 'none'; // 让片段不挡住轨道检测

            const onMouseMove = (moveEvent) => {
                // 水平移动 - 时间
                const deltaX = moveEvent.clientX - this.dragStartX;
                const deltaTime = deltaX / this.pixelsPerSecond;
                let newTime = this.dragStartTime + deltaTime;

                if (this.snapToGrid) {
                    newTime = this.snapTime(newTime);
                }

                newTime = Math.max(0, newTime);

                clip.setStartTime(newTime);
                this.updateClipPosition(clip, clipEl);

                // 垂直移动 - 检测目标轨道
                const targetTrackEl = this.getTrackAtPosition(moveEvent.clientX, moveEvent.clientY);
                if (targetTrackEl) {
                    targetTrackEl.classList.add('drag-hover');
                }
                // 清除其他轨道的高亮
                this.trackElements.forEach((el, id) => {
                    if (el !== targetTrackEl) {
                        el.classList.remove('drag-hover');
                    }
                });
            };

            const onMouseUp = (upEvent) => {
                clipEl.style.cursor = 'grab';
                clipEl.style.zIndex = '';
                clipEl.style.pointerEvents = '';

                // 清除所有轨道高亮
                this.trackElements.forEach(el => el.classList.remove('drag-hover'));

                // 检测目标轨道
                const targetTrackEl = this.getTrackAtPosition(upEvent.clientX, upEvent.clientY);
                if (targetTrackEl) {
                    const targetTrackId = targetTrackEl.dataset.trackId;
                    if (targetTrackId !== this.dragStartTrackId) {
                        // 跨轨道移动
                        this.moveClipToTrack(clip, this.dragStartTrackId, targetTrackId);
                    }
                }

                this.draggingClip = null;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                if (this.onClipMove) {
                    this.onClipMove(clip);
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        trackEl.appendChild(clipEl);
        this.clipElements.set(clip.id, clipEl);
    }

    /**
     * 更新片段位置
     * @param {AudioClip} clip - 音频片段
     * @param {HTMLElement} clipEl - 片段元素
     */
    updateClipPosition(clip, clipEl) {
        const left = clip.startTime * this.pixelsPerSecond;
        const width = clip.duration * this.pixelsPerSecond;

        clipEl.style.left = `${left}px`;
        clipEl.style.width = `${Math.max(20, width)}px`;
    }

    /**
     * 更新所有片段位置
     */
    updateAllClips() {
        audioEngine.tracks.forEach(track => {
            track.clips.forEach(clip => {
                const clipEl = this.clipElements.get(clip.id);
                if (clipEl) {
                    this.updateClipPosition(clip, clipEl);
                }
            });
        });
    }

    /**
     * 选择片段
     * @param {AudioClip} clip - 音频片段
     */
    selectClip(clip) {
        // 取消之前的选择
        if (this.selectedClip) {
            this.selectedClip.selected = false;
            const prevEl = this.clipElements.get(this.selectedClip.id);
            if (prevEl) {
                prevEl.classList.remove('selected');
            }
        }

        // 设置新选择
        this.selectedClip = clip;
        clip.selected = true;

        const clipEl = this.clipElements.get(clip.id);
        if (clipEl) {
            clipEl.classList.add('selected');
        }

        if (this.onClipSelect) {
            this.onClipSelect(clip);
        }
    }

    /**
     * 取消选择
     */
    deselectClip() {
        if (this.selectedClip) {
            const clipEl = this.clipElements.get(this.selectedClip.id);
            if (clipEl) {
                clipEl.classList.remove('selected');
            }
            this.selectedClip.selected = false;
            this.selectedClip = null;
        }
    }

    /**
     * 删除选中的片段
     */
    deleteSelectedClip() {
        if (!this.selectedClip) return;

        const clip = this.selectedClip;
        const track = audioEngine.tracks.find(t => t.id === clip.trackId);

        if (track) {
            track.removeClip(clip.id);
        }

        const clipEl = this.clipElements.get(clip.id);
        if (clipEl) {
            clipEl.remove();
            this.clipElements.delete(clip.id);
        }

        const waveform = this.clipWaveforms.get(clip.id);
        if (waveform) {
            waveform.destroy();
            this.clipWaveforms.delete(clip.id);
        }

        this.selectedClip = null;
    }

    /**
     * 吸附时间到网格
     * @param {number} time - 时间（秒）
     * @returns {number}
     */
    snapTime(time) {
        const secondsPerBeat = 60 / audioEngine.tempo;
        const snapInterval = secondsPerBeat * this.gridSize;
        return Math.round(time / snapInterval) * snapInterval;
    }

    /**
     * 显示右键菜单
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {AudioClip} clip - 音频片段
     */
    showContextMenu(x, y, clip) {
        // 移除已有的菜单
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        const items = [
            { label: '📋 复制', action: 'copy', shortcut: 'Ctrl+C' },
            { label: '✂️ 剪切', action: 'cut', shortcut: 'Ctrl+X' },
            { label: '📑 复制到后方', action: 'duplicate', shortcut: 'Ctrl+D' },
            { label: '🗑️ 删除', action: 'delete', shortcut: 'Delete' }
        ];

        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.innerHTML = `<span>${item.label}</span><span class="shortcut">${item.shortcut}</span>`;
            menuItem.addEventListener('click', () => {
                this.hideContextMenu();
                if (this.onContextMenuAction) {
                    this.onContextMenuAction(item.action, clip);
                }
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // 点击其他地方关闭菜单
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
            }
        };
        this.contextMenuCloseHandler = closeHandler;
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    /**
     * 隐藏右键菜单
     */
    hideContextMenu() {
        if (this.contextMenuCloseHandler) {
            document.removeEventListener('click', this.contextMenuCloseHandler);
            this.contextMenuCloseHandler = null;
        }
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    /**
     * 右键菜单操作回调
     */
    onContextMenuAction = null;

    /**
     * 文件拖放回调
     */
    onFileDrop = null;

    /**
     * 获取指定位置的轨道元素
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标  
     * @returns {HTMLElement|null}
     */
    getTrackAtPosition(x, y) {
        for (const [trackId, trackEl] of this.trackElements) {
            const rect = trackEl.getBoundingClientRect();
            if (y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right) {
                return trackEl;
            }
        }
        return null;
    }

    /**
     * 将片段移动到另一个轨道
     * @param {AudioClip} clip - 音频片段
     * @param {string} fromTrackId - 原轨道 ID
     * @param {string} toTrackId - 目标轨道 ID
     */
    moveClipToTrack(clip, fromTrackId, toTrackId) {
        const fromTrack = audioEngine.getTrack(fromTrackId);
        const toTrack = audioEngine.getTrack(toTrackId);

        if (!fromTrack || !toTrack) return;

        // 从原轨道移除
        fromTrack.removeClip(clip.id);

        // 更新片段的轨道引用
        clip.trackId = toTrackId;

        // 添加到新轨道
        toTrack.addClip(clip);

        // 移动 DOM 元素
        const clipEl = this.clipElements.get(clip.id);
        const toTrackEl = this.trackElements.get(toTrackId);

        if (clipEl && toTrackEl) {
            toTrackEl.appendChild(clipEl);
        }
    }

    /**
     * 显示轨道右键菜单（空白区域）
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {Track} track - 轨道对象
     * @param {MouseEvent} event - 鼠标事件
     */
    showTrackContextMenu(x, y, track, event) {
        // 移除已有的菜单
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // 计算点击位置的时间
        const trackEl = this.trackElements.get(track.id);
        if (!trackEl) return;
        const rect = trackEl.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickTime = this.snapToGrid ? this.snapTime(clickX / this.pixelsPerSecond) : clickX / this.pixelsPerSecond;

        const items = [
            { label: '📑 粘贴', action: 'paste', shortcut: 'Ctrl+V' },
            { label: '➕ 添加音轨', action: 'add-track', shortcut: '' },
            { label: '✏️ 重命名轨道', action: 'rename-track', shortcut: '' },
            { label: '🗑️ 删除轨道', action: 'delete-track', shortcut: '' }
        ];

        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            const shortcutHtml = item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : '';
            menuItem.innerHTML = `<span>${item.label}</span>${shortcutHtml}`;
            menuItem.addEventListener('click', () => {
                this.hideContextMenu();
                if (this.onTrackContextMenuAction) {
                    this.onTrackContextMenuAction(item.action, track, clickTime);
                }
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // 点击其他地方关闭菜单
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
            }
        };
        this.contextMenuCloseHandler = closeHandler;
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    /**
     * 轨道右键菜单操作回调
     */
    onTrackContextMenuAction = null;

    /**
     * 开始编辑片段名称
     * @param {AudioClip} clip - 音频片段
     * @param {HTMLElement} nameSpan - 名称 span 元素
     */
    startEditClipName(clip, nameSpan) {
        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = clip.name;
        input.className = 'clip-name-input';
        input.style.cssText = `
            width: calc(100% - 8px);
            background: var(--bg-dark, #1a1a25);
            border: 1px solid var(--color-primary, #ff6b35);
            color: var(--text-primary, #fff);
            font-size: 11px;
            padding: 2px 4px;
            border-radius: 3px;
            outline: none;
        `;

        // 替换 span 为 input
        nameSpan.style.display = 'none';
        nameSpan.parentNode.appendChild(input);
        input.focus();
        input.select();

        // 完成编辑
        const finishEdit = () => {
            const newName = input.value.trim();
            if (newName && newName !== clip.name) {
                clip.name = newName;
                nameSpan.textContent = newName;
                console.log(`✏️ 片段已重命名为: ${newName}`);
            }
            nameSpan.style.display = '';
            input.remove();
        };

        // 按 Enter 或失去焦点时完成编辑
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = clip.name; // 恢复原名
                input.blur();
            }
        });

        // 阻止事件冒泡以免触发拖动
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
    }
}
