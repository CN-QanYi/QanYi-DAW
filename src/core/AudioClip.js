/**
 * AudioClip - 音频片段类
 * 代表时间线上的一个音频片段
 */

let clipCounter = 0;

export class AudioClip {
    /**
     * @param {Object} options - 片段配置
     * @param {AudioBuffer} options.audioBuffer - 解码后的音频数据
     * @param {string} [options.name] - 片段名称
     * @param {number} [options.startTime] - 在时间线上的起始位置（秒）
     * @param {number} [options.offset] - 音频内部偏移（秒）
     * @param {number} [options.duration] - 持续时间（秒）
     */
    constructor(options = {}) {
        this.id = `clip_${Date.now()}_${++clipCounter}`;
        this.name = options.name || 'Audio Clip';
        this.audioBuffer = options.audioBuffer;
        this.trackId = null;

        // 时间参数
        this.startTime = options.startTime || 0;
        this.offset = options.offset || 0;
        this.duration = options.duration || (this.audioBuffer ? this.audioBuffer.duration : 0);

        // 增益参数
        this.gain = 1.0;

        // 波形数据缓存
        this.waveformData = null;

        // 选中状态
        this.selected = false;
    }

    /**
     * 获取原始音频时长
     * @returns {number}
     */
    getOriginalDuration() {
        return this.audioBuffer ? this.audioBuffer.duration : 0;
    }

    /**
     * 设置开始时间
     * @param {number} time - 开始时间（秒）
     */
    setStartTime(time) {
        this.startTime = Math.max(0, time);
    }

    /**
     * 移动片段
     * @param {number} deltaTime - 时间偏移量（秒）
     */
    move(deltaTime) {
        this.setStartTime(this.startTime + deltaTime);
    }

    /**
     * 设置持续时间
     * @param {number} duration - 持续时间（秒）
     */
    setDuration(duration) {
        const maxDuration = this.getOriginalDuration() - this.offset;
        this.duration = Math.max(0.1, Math.min(maxDuration, duration));
    }

    /**
     * 生成波形数据
     * @param {number} samples - 采样点数
     * @returns {Float32Array} 波形数据
     */
    generateWaveformData(samples = 200) {
        if (!this.audioBuffer) return new Float32Array(samples);

        const channelData = this.audioBuffer.getChannelData(0);
        const totalSamples = channelData.length;
        const samplesPerPoint = Math.floor(totalSamples / samples);

        const waveform = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
            const start = i * samplesPerPoint;
            const end = Math.min(start + samplesPerPoint, totalSamples);

            let max = 0;
            for (let j = start; j < end; j++) {
                const absValue = Math.abs(channelData[j]);
                if (absValue > max) max = absValue;
            }

            waveform[i] = max;
        }

        this.waveformData = waveform;
        return waveform;
    }

    /**
     * 获取波形数据
     * @param {number} samples - 采样点数
     * @returns {Float32Array}
     */
    getWaveformData(samples = 200) {
        if (!this.waveformData || this.waveformData.length !== samples) {
            return this.generateWaveformData(samples);
        }
        return this.waveformData;
    }

    /**
     * 复制片段
     * @returns {AudioClip}
     */
    clone() {
        return new AudioClip({
            audioBuffer: this.audioBuffer,
            name: this.name,
            startTime: this.startTime,
            offset: this.offset,
            duration: this.duration
        });
    }

    /**
     * 序列化为 JSON（不包含 audioBuffer）
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            trackId: this.trackId,
            startTime: this.startTime,
            offset: this.offset,
            duration: this.duration,
            gain: this.gain
        };
    }
}
