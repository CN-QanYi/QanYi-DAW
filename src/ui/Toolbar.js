/**
 * Toolbar - 顶部工具栏组件
 * 负责传输控制、BPM 设置、时间显示和文件导入
 */
import { audioEngine } from '../core/AudioEngine.js';

export class Toolbar {
    constructor() {
        // DOM 元素
        this.btnPlay = document.getElementById('btn-play');
        this.btnPause = document.getElementById('btn-pause');
        this.btnStop = document.getElementById('btn-stop');
        this.bpmInput = document.getElementById('bpm-input');
        this.timeDisplay = document.getElementById('time-display');
        this.btnImport = document.getElementById('btn-import');
        this.fileInput = document.getElementById('file-input');

        const missing = [];
        if (!this.btnPlay) missing.push('btn-play');
        if (!this.btnPause) missing.push('btn-pause');
        if (!this.btnStop) missing.push('btn-stop');
        if (!this.bpmInput) missing.push('bpm-input');
        if (!this.timeDisplay) missing.push('time-display');
        if (!this.btnImport) missing.push('btn-import');
        if (!this.fileInput) missing.push('file-input');
        if (missing.length > 0) {
            throw new Error(`Missing toolbar element: ${missing.join(', ')}`);
        }

        // 事件回调
        this.onFileImport = null;

        this.init();
    }

    /**
     * 初始化工具栏
     */
    init() {
        // 播放控制按钮
        this.btnPlay?.addEventListener('click', () => this.handlePlay());
        this.btnPause?.addEventListener('click', () => this.handlePause());
        this.btnStop?.addEventListener('click', () => this.handleStop());

        // BPM 输入
        this.bpmInput?.addEventListener('change', (e) => {
            const bpm = this.validateAndClampBpm(e.target.value);
            if (bpm === null) return;
            this.bpmInput.value = bpm;
            audioEngine.setTempo(bpm);
        });

        this.bpmInput?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            const currentValue = this.validateAndClampBpm(this.bpmInput.value);
            const nextValue = this.validateAndClampBpm((currentValue ?? 120) + delta);
            if (nextValue === null) return;
            this.bpmInput.value = nextValue;
            audioEngine.setTempo(nextValue);
        });

        // 文件导入
        this.btnImport?.addEventListener('click', () => {
            this.fileInput?.click();
        });

        this.fileInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0 && this.onFileImport) {
                this.onFileImport(files);
            }
            e.target.value = '';
        });

        // 音频引擎回调
        const prevTimeHandler = audioEngine.onTimeUpdate;
        audioEngine.onTimeUpdate = (time) => {
            if (typeof prevTimeHandler === 'function') {
                prevTimeHandler(time);
            }
            this.updateTimeDisplay(time);
        };

        const prevPlayStateHandler = audioEngine.onPlayStateChange;
        audioEngine.onPlayStateChange = (state) => {
            if (typeof prevPlayStateHandler === 'function') {
                prevPlayStateHandler(state);
            }
            this.updatePlayState(state);
        };
    }

    /**
     * 处理播放
     */
    handlePlay() {
        audioEngine.play();
    }

    /**
     * 处理暂停
     */
    handlePause() {
        audioEngine.pause();
    }

    /**
     * 处理停止
     */
    handleStop() {
        audioEngine.stop();
    }

    /**
     * 更新时间显示
     * @param {number} time - 当前时间（秒）
     */
    updateTimeDisplay(time) {
        if (!this.timeDisplay) return;
        this.timeDisplay.textContent = audioEngine.formatTime(time);
    }

    /**
     * 更新播放状态 UI
     * @param {string} state - 播放状态
     */
    updatePlayState(state) {
        this.btnPlay?.classList.remove('active');
        this.btnPause?.classList.remove('active');
        this.btnStop?.classList.remove('active');

        switch (state) {
            case 'playing':
                this.btnPlay?.classList.add('active');
                break;
            case 'paused':
                this.btnPause?.classList.add('active');
                break;
            case 'stopped':
                // 无激活状态
                break;
        }
    }

    /**
     * 设置 BPM 值
     * @param {number} bpm - BPM 值
     */
    setBpm(bpm) {
        const validatedBpm = this.validateAndClampBpm(bpm);
        if (validatedBpm === null) return;
        if (this.bpmInput) {
            this.bpmInput.value = validatedBpm;
        }
        audioEngine.setTempo(validatedBpm);
    }

    /**
     * 获取当前 BPM
     * @returns {number}
     */
    getBpm() {
        if (!this.bpmInput) return NaN;
        return parseInt(this.bpmInput.value, 10);
    }

    /**
     * 校验并限制 BPM 范围
     * @param {number|string} value - 输入值
     * @returns {number|null}
     */
    validateAndClampBpm(value) {
        const bpm = parseInt(value, 10);
        if (Number.isNaN(bpm)) return null;
        return Math.max(20, Math.min(300, bpm));
    }
}
