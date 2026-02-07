/**
 * AudioEngine - Web Audio API 音频引擎核心
 * 负责音频上下文管理、音频解码、播放控制
 */
export class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.tempo = 120;
        this.currentTime = 0;
        this.tracks = [];
        this.activeSources = [];
        this.animationFrameId = null;

        // 事件回调
        this.onTimeUpdate = null;
        this.onPlayStateChange = null;
    }

    /**
     * 初始化音频上下文
     */
    async init() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // 创建主增益节点
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 0.8;

        // 如果上下文被暂停，恢复它
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        console.log('AudioEngine initialized');
    }

    /**
     * 加载并解码音频文件
     * @param {File} file - 音频文件
     * @returns {Promise<AudioBuffer>} 解码后的音频缓冲区
     */
    async loadAudioFile(file) {
        await this.init();

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        return audioBuffer;
    }

    /**
     * 从 URL 加载音频
     * @param {string} url - 音频 URL
     * @returns {Promise<AudioBuffer>}
     */
    async loadAudioFromUrl(url) {
        await this.init();

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        return audioBuffer;
    }

    /**
     * 播放所有活动的音频片段
     */
    async play() {
        if (this.isPlaying && !this.isPaused) return;

        await this.init();

        if (this.isPaused) {
            // 从暂停位置恢复
            this.startTime = this.audioContext.currentTime - this.pauseTime;
            this.isPaused = false;
        } else {
            // 从头开始或从当前位置开始
            this.startTime = this.audioContext.currentTime - this.currentTime;
        }

        this.isPlaying = true;
        this.schedulePlayback();
        this.startTimeUpdate();

        if (this.onPlayStateChange) {
            this.onPlayStateChange('playing');
        }
    }

    /**
     * 暂停播放
     */
    pause() {
        if (!this.isPlaying || this.isPaused) return;

        this.isPaused = true;
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.stopAllSources();
        this.stopTimeUpdate();

        if (this.onPlayStateChange) {
            this.onPlayStateChange('paused');
        }
    }

    /**
     * 停止播放并重置位置
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.pauseTime = 0;
        this.stopAllSources();
        this.stopTimeUpdate();

        if (this.onTimeUpdate) {
            this.onTimeUpdate(0);
        }

        if (this.onPlayStateChange) {
            this.onPlayStateChange('stopped');
        }
    }

    /**
     * 跳转到指定时间位置
     * @param {number} time - 目标时间（秒）
     */
    seekTo(time) {
        const wasPlaying = this.isPlaying && !this.isPaused;

        if (!this.audioContext) {
            // 尝试初始化（通常需要用户手势）；无法同步等待，故短路以避免访问 currentTime 报错
            this.init().catch((e) => {
                console.error('AudioEngine init failed in seekTo:', e);
            });

            if (wasPlaying) {
                this.stopAllSources();
            }

            this.currentTime = Math.max(0, time);
            this.pauseTime = this.currentTime;

            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.currentTime);
            }
            return;
        }

        if (wasPlaying) {
            this.stopAllSources();
        }

        this.currentTime = Math.max(0, time);
        this.startTime = this.audioContext.currentTime - this.currentTime;
        this.pauseTime = this.currentTime;

        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }

        if (wasPlaying) {
            this.schedulePlayback();
        }
    }

    /**
     * 调度音频播放
     */
    schedulePlayback() {
        this.stopAllSources();

        const currentPlayTime = this.audioContext.currentTime - this.startTime;

        this.tracks.forEach(track => {
            if (track.muted) return;

            track.clips.forEach(clip => {
                if (clip.startTime + clip.duration < currentPlayTime) return;

                const source = this.audioContext.createBufferSource();
                source.buffer = clip.audioBuffer;
                source.connect(track.gainNode);

                let when = 0;
                let offset = 0;

                if (clip.startTime >= currentPlayTime) {
                    // 片段还未开始
                    when = this.audioContext.currentTime + (clip.startTime - currentPlayTime);
                    offset = clip.offset || 0;
                } else {
                    // 片段已经开始
                    when = this.audioContext.currentTime;
                    offset = (clip.offset || 0) + (currentPlayTime - clip.startTime);
                }

                const duration = clip.duration - (offset - (clip.offset || 0));

                if (duration > 0) {
                    source.start(when, offset, duration);
                    this.activeSources.push(source);
                }
            });
        });
    }

    /**
     * 停止所有活动的音频源
     */
    stopAllSources() {
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // 忽略已停止的源
            }
        });
        this.activeSources = [];
    }

    /**
     * 开始时间更新循环
     */
    startTimeUpdate() {
        const update = () => {
            if (!this.isPlaying || this.isPaused) return;

            this.currentTime = this.audioContext.currentTime - this.startTime;

            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.currentTime);
            }

            this.animationFrameId = requestAnimationFrame(update);
        };

        update();
    }

    /**
     * 停止时间更新循环
     */
    stopTimeUpdate() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * 设置 BPM
     * @param {number} bpm - 每分钟节拍数
     */
    setTempo(bpm) {
        this.tempo = Math.max(20, Math.min(300, bpm));
    }

    /**
     * 设置主音量
     * @param {number} volume - 音量 (0-1)
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * 添加音轨
     * @param {Track} track - 音轨对象
     */
    async addTrack(track) {
        await this.init();
        track.gainNode = this.audioContext.createGain();
        track.gainNode.gain.value = track.volume;
        track.gainNode.connect(this.masterGain);
        this.tracks.push(track);
    }

    /**
     * 移除音轨
     * @param {string} trackId - 音轨 ID
     */
    removeTrack(trackId) {
        const index = this.tracks.findIndex(t => t.id === trackId);
        if (index !== -1) {
            const track = this.tracks[index];
            if (track.gainNode) {
                track.gainNode.disconnect();
            }
            this.tracks.splice(index, 1);
        }
    }

    /**
     * 获取音轨
     * @param {string} trackId - 音轨 ID
     * @returns {Track|undefined}
     */
    getTrack(trackId) {
        return this.tracks.find(t => t.id === trackId);
    }

    /**
     * 将秒转换为时间显示格式 (小节:拍:tick)
     * @param {number} seconds - 秒数
     * @returns {string} 格式化的时间字符串
     */
    formatTime(seconds) {
        const beatsPerSecond = this.tempo / 60;
        const totalBeats = seconds * beatsPerSecond;

        const bars = Math.floor(totalBeats / 4) + 1;
        const beats = Math.floor(totalBeats % 4) + 1;
        const ticks = Math.floor((totalBeats % 1) * 1000);

        return `${String(bars).padStart(3, '0')}:${String(beats).padStart(2, '0')}:${String(ticks).padStart(3, '0')}`;
    }

    /**
     * 获取每拍的像素数（用于时间线缩放）
     * @param {number} pixelsPerSecond - 每秒像素数
     * @returns {number}
     */
    getPixelsPerBeat(pixelsPerSecond = 50) {
        return pixelsPerSecond * (60 / this.tempo);
    }
}

// 创建单例实例
export const audioEngine = new AudioEngine();
