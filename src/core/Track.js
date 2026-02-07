/**
 * Track - 音轨类
 * 代表 DAW 中的一个音轨，包含音频片段和控制参数
 */

// 预定义的音轨颜色
const TRACK_COLORS = [
    '#6366f1', // 紫色
    '#ec4899', // 粉色
    '#f97316', // 橙色
    '#22c55e', // 绿色
    '#3b82f6', // 蓝色
    '#eab308', // 黄色
    '#14b8a6', // 青色
    '#f43f5e', // 红色
];

let trackCounter = 0;

export class Track {
    /**
     * @param {Object} options - 音轨配置
     * @param {string} [options.name] - 音轨名称
     * @param {string} [options.color] - 音轨颜色
     */
    constructor(options = {}) {
        trackCounter++;
        this.id = `track_${Date.now()}_${trackCounter}`;
        this.name = options.name || `Track ${trackCounter}`;
        this.color = options.color || TRACK_COLORS[(trackCounter - 1) % TRACK_COLORS.length];

        // 音频控制参数
        this.volume = 0.8;
        this.pan = 0; // -1 (左) 到 1 (右)
        this.muted = false;
        this.solo = false;

        // 音频片段列表
        this.clips = [];

        // Web Audio 节点（由 AudioEngine 创建）
        this.gainNode = null;
    }

    /**
     * 设置音轨名称
     * @param {string} name - 新名称
     */
    setName(name) {
        this.name = name || this.name;
    }

    /**
     * 设置音量
     * @param {number} volume - 音量 (0-1)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.muted ? 0 : this.volume;
        }
    }

    /**
     * 设置静音状态
     * @param {boolean} muted - 是否静音
     */
    setMuted(muted) {
        this.muted = muted;
        if (this.gainNode) {
            this.gainNode.gain.value = this.muted ? 0 : this.volume;
        }
    }

    /**
     * 切换静音状态
     */
    toggleMute() {
        this.setMuted(!this.muted);
    }

    /**
     * 设置独奏状态
     * @param {boolean} solo - 是否独奏
     */
    setSolo(solo) {
        this.solo = solo;
    }

    /**
     * 切换独奏状态
     */
    toggleSolo() {
        this.setSolo(!this.solo);
    }

    /**
     * 添加音频片段
     * @param {AudioClip} clip - 音频片段
     */
    addClip(clip) {
        clip.trackId = this.id;
        this.clips.push(clip);
        this.sortClips();
    }

    /**
     * 移除音频片段
     * @param {string} clipId - 片段 ID
     */
    removeClip(clipId) {
        const index = this.clips.findIndex(c => c.id === clipId);
        if (index !== -1) {
            this.clips.splice(index, 1);
        }
    }

    /**
     * 获取音频片段
     * @param {string} clipId - 片段 ID
     * @returns {AudioClip|undefined}
     */
    getClip(clipId) {
        return this.clips.find(c => c.id === clipId);
    }

    /**
     * 按开始时间排序片段
     */
    sortClips() {
        this.clips.sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * 获取音轨总时长
     * @returns {number} 最后一个片段的结束时间
     */
    getDuration() {
        if (this.clips.length === 0) return 0;

        let maxEnd = 0;
        this.clips.forEach(clip => {
            const end = clip.startTime + clip.duration;
            if (end > maxEnd) maxEnd = end;
        });

        return maxEnd;
    }

    /**
     * 序列化为 JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            volume: this.volume,
            pan: this.pan,
            muted: this.muted,
            solo: this.solo,
            clips: this.clips.map(c => c.toJSON())
        };
    }
}
