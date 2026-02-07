/**
 * Waveform - 波形绘制组件
 * 使用 Canvas 绘制音频波形
 */
export class Waveform {
    /**
     * @param {HTMLCanvasElement} canvas - Canvas 元素
     * @param {Object} options - 配置选项
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 配置
        this.fillColor = options.fillColor || '#6366f1';
        this.backgroundColor = options.backgroundColor || 'transparent';
        this.lineColor = options.lineColor || '#818cf8';
        this.centerLineColor = options.centerLineColor || 'rgba(255,255,255,0.1)';

        // 波形数据
        this.waveformData = null;

        // 设置 canvas 尺寸
        this.resize();
    }

    /**
     * 调整 canvas 尺寸
     */
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        if (typeof this.ctx.resetTransform === 'function') {
            this.ctx.resetTransform();
        } else {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;

        // 重新绘制
        if (this.waveformData) {
            this.draw(this.waveformData);
        }
    }

    /**
     * 设置波形数据并绘制
     * @param {Float32Array} data - 波形数据
     */
    setData(data) {
        this.waveformData = data;
        this.draw(data);
    }

    /**
     * 绘制波形
     * @param {Float32Array} data - 波形数据
     */
    draw(data) {
        if (!data || data.length === 0) {
            this.clear();
            return;
        }

        const { ctx, width, height } = this;
        const centerY = height / 2;
        const samples = data.length;
        const barWidth = width / samples;

        // 清除画布
        ctx.clearRect(0, 0, width, height);

        // 绘制背景
        if (this.backgroundColor !== 'transparent') {
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        // 绘制中心线
        ctx.strokeStyle = this.centerLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // 绘制波形条
        ctx.fillStyle = this.fillColor;

        for (let i = 0; i < samples; i++) {
            const x = i * barWidth;
            const amplitude = data[i] * (height * 0.8);
            const y = centerY - amplitude / 2;

            // 绘制对称的波形条
            ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), amplitude);
        }

        // 绘制波形轮廓线
        ctx.strokeStyle = this.lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i < samples; i++) {
            const x = i * barWidth + barWidth / 2;
            const amplitude = data[i] * (height * 0.4);
            const y = centerY - amplitude;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // 绘制镜像轮廓
        ctx.beginPath();

        for (let i = 0; i < samples; i++) {
            const x = i * barWidth + barWidth / 2;
            const amplitude = data[i] * (height * 0.4);
            const y = centerY + amplitude;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    /**
     * 清除画布
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.waveformData = null;
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.clear();
        this.canvas = null;
        this.ctx = null;
    }
}

/**
 * 为 AudioClip 创建波形
 * @param {AudioClip} clip - 音频片段
 * @param {HTMLElement} container - 容器元素
 * @param {Object} options - 配置选项
 * @returns {Waveform}
 */
export function createWaveformForClip(clip, container, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const waveform = new Waveform(canvas, options);
    const data = clip.getWaveformData(200);
    waveform.setData(data);

    return waveform;
}
