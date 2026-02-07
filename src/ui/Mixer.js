/**
 * Mixer - 混音器面板组件
 * 负责显示各轨道的推子和电平表
 */
import { audioEngine } from '../core/AudioEngine.js';

export class Mixer {
    constructor() {
        this.container = document.getElementById('mixer');
        this.header = document.querySelector('.mixer-header');
        this.channelsContainer = document.getElementById('mixer-channels');
        this.toggleBtn = document.getElementById('btn-toggle-mixer');
        this.masterFader = document.getElementById('master-fader');
        this.masterValue = document.getElementById('master-value');
        this.masterMeterL = document.getElementById('master-meter-l');
        this.masterMeterR = document.getElementById('master-meter-r');

        const missing = [];
        if (!this.container) missing.push('mixer');
        if (!this.header) missing.push('mixer-header');
        if (!this.channelsContainer) missing.push('mixer-channels');
        if (!this.toggleBtn) missing.push('btn-toggle-mixer');
        if (!this.masterFader) missing.push('master-fader');
        if (!this.masterValue) missing.push('master-value');
        if (!this.masterMeterL) missing.push('master-meter-l');
        if (!this.masterMeterR) missing.push('master-meter-r');
        if (missing.length > 0) {
            throw new Error(`Missing DOM element: ${missing.join(', ')}`);
        }

        // 通道元素映射
        this.channelElements = new Map();

        // 状态
        this.isCollapsed = false;
        this.analyser = null;
        this.animationFrameId = null;

        this.init();
    }

    /**
     * 初始化混音器
     */
    init() {
        // 折叠/展开
        this.header.addEventListener('click', () => {
            this.toggle();
        });

        // 主推子 - 首次交互时初始化音频分析器
        this.masterFader.addEventListener('input', async (e) => {
            if (!this.analyser) {
                await this.initAnalyser();
            }
            const value = parseInt(e.target.value, 10);
            const volume = value / 100;
            audioEngine.setMasterVolume(volume);
            this.updateMasterValue(volume);
        });

        // 点击混音器区域时初始化分析器（用户手势）
        const onMixerClick = async () => {
            if (this.analyser) {
                this.container.removeEventListener('click', onMixerClick);
                return;
            }

            if (!audioEngine.audioContext) {
                return;
            }

            await this.initAnalyser();
            if (this.analyser) {
                this.container.removeEventListener('click', onMixerClick);
            }
        };

        this.container.addEventListener('click', onMixerClick);
    }

    /**
     * 初始化音频分析器（延迟到用户交互后）
     */
    async initAnalyser() {
        if (this.analyser) return; // 防止重复初始化

        if (!audioEngine.audioContext) {
            // 如果音频上下文还没初始化，等待
            return;
        }

        // 创建分析器节点
        this.analyser = audioEngine.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        // 连接到主输出
        audioEngine.masterGain.connect(this.analyser);

        // 开始电平监测
        this.startMeterAnimation();
    }

    /**
     * 开始电平表动画
     */
    startMeterAnimation() {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const update = () => {
            this.analyser.getByteFrequencyData(dataArray);

            // 计算平均电平
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length / 255;

            // 更新主电平表
            const scaleY = Math.min(1, average * 2);
            this.masterMeterL.style.transform = `scaleY(${scaleY})`;
            this.masterMeterR.style.transform = `scaleY(${scaleY * 0.95})`;

            this.animationFrameId = requestAnimationFrame(update);
        };

        update();
    }

    /**
     * 停止电平表动画
     */
    stopMeterAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * 折叠/展开混音器
     */
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        document.getElementById('app').classList.toggle('mixer-collapsed', this.isCollapsed);
    }

    /**
     * 添加轨道通道
     * @param {Track} track - 音轨对象
     */
    addChannel(track) {
        const channelEl = document.createElement('div');
        channelEl.className = 'mixer-channel';
        channelEl.dataset.trackId = track.id;

                const labelEl = document.createElement('div');
                labelEl.className = 'channel-label';
                labelEl.textContent = track.name;

                const meterEl = document.createElement('div');
                meterEl.className = 'channel-meter';

                const meterFillL = document.createElement('div');
                meterFillL.className = 'meter-fill';
                meterFillL.style.transform = 'scaleY(0.2)';

                const meterFillR = document.createElement('div');
                meterFillR.className = 'meter-fill';
                meterFillR.style.transform = 'scaleY(0.2)';

                meterEl.appendChild(meterFillL);
                meterEl.appendChild(meterFillR);

                const fader = document.createElement('input');
                fader.type = 'range';
                fader.className = 'channel-fader';
                fader.min = '0';
                fader.max = '100';
                fader.value = String(Math.round(track.volume * 100));
                fader.setAttribute('orient', 'vertical');

                const valueDisplay = document.createElement('div');
                valueDisplay.className = 'channel-value';
                valueDisplay.textContent = this.volumeToDb(track.volume);

                channelEl.appendChild(labelEl);
                channelEl.appendChild(meterEl);
                channelEl.appendChild(fader);
                channelEl.appendChild(valueDisplay);

        fader.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            const volume = value / 100;
            track.setVolume(volume);
            valueDisplay.textContent = this.volumeToDb(volume);
        });

        // 插入到主通道之前
        const masterChannel = this.channelsContainer.querySelector('.master-channel');
        this.channelsContainer.insertBefore(channelEl, masterChannel);

        this.channelElements.set(track.id, channelEl);
    }

    /**
     * 移除轨道通道
     * @param {string} trackId - 音轨 ID
     */
    removeChannel(trackId) {
        const channelEl = this.channelElements.get(trackId);
        if (channelEl) {
            channelEl.remove();
            this.channelElements.delete(trackId);
        }
    }

    /**
     * 更新通道显示
     * @param {Track} track - 音轨对象
     */
    updateChannel(track) {
        const channelEl = this.channelElements.get(track.id);
        if (!channelEl) return;

        const label = channelEl.querySelector('.channel-label');
        const fader = channelEl.querySelector('.channel-fader');
        const valueDisplay = channelEl.querySelector('.channel-value');

        label.textContent = track.name;
        fader.value = Math.round(track.volume * 100);
        valueDisplay.textContent = this.volumeToDb(track.volume);
    }

    /**
     * 更新主音量显示
     * @param {number} volume - 音量 (0-1)
     */
    updateMasterValue(volume) {
        this.masterValue.textContent = this.volumeToDb(volume);
    }

    /**
     * 将音量转换为分贝显示
     * @param {number} volume - 音量 (0-1)
     * @returns {string}
     */
    volumeToDb(volume) {
        if (volume === 0) return '-∞ dB';
        const db = 20 * Math.log10(volume);
        return `${db.toFixed(1)} dB`;
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.stopMeterAnimation();
        if (this.analyser) {
            this.analyser.disconnect();
        }
    }
}
