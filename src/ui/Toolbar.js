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

        // 事件回调
        this.onFileImport = null;

        this.init();
    }

    /**
     * 初始化工具栏
     */
    init() {
        // 播放控制按钮
        this.btnPlay.addEventListener('click', () => this.handlePlay());
        this.btnPause.addEventListener('click', () => this.handlePause());
        this.btnStop.addEventListener('click', () => this.handleStop());

        // BPM 输入
        this.bpmInput.addEventListener('change', (e) => {
            const bpm = parseInt(e.target.value, 10);
            if (!isNaN(bpm)) {
                audioEngine.setTempo(bpm);
            }
        });

        this.bpmInput.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            const currentValue = parseInt(this.bpmInput.value, 10);
            this.bpmInput.value = Math.max(20, Math.min(300, currentValue + delta));
            audioEngine.setTempo(parseInt(this.bpmInput.value, 10));
        });

        // 文件导入
        this.btnImport.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
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
        this.timeDisplay.textContent = audioEngine.formatTime(time);
    }

    /**
     * 更新播放状态 UI
     * @param {string} state - 播放状态
     */
    updatePlayState(state) {
        this.btnPlay.classList.remove('active');
        this.btnPause.classList.remove('active');
        this.btnStop.classList.remove('active');

        switch (state) {
            case 'playing':
                this.btnPlay.classList.add('active');
                break;
            case 'paused':
                this.btnPause.classList.add('active');
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
        this.bpmInput.value = bpm;
        audioEngine.setTempo(bpm);
    }

    /**
     * 获取当前 BPM
     * @returns {number}
     */
    getBpm() {
        return parseInt(this.bpmInput.value, 10);
    }
}
