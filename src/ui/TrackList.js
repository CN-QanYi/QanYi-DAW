/**
 * TrackList - 音轨列表组件
 * 负责显示和管理音轨列表
 */
import { Track } from '../core/Track.js';
import { audioEngine } from '../core/AudioEngine.js';

export class TrackList {
    constructor() {
        this.container = document.getElementById('track-items');
        this.btnAddTrack = document.getElementById('btn-add-track');

        // 事件回调
        this.onTrackAdd = null;
        this.onTrackSelect = null;
        this.onTrackUpdate = null;

        // 选中的音轨 ID
        this.selectedTrackId = null;

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.btnAddTrack.addEventListener('click', () => {
            this.addNewTrack();
        });
    }

    /**
     * 添加新音轨
     * @returns {Promise<Track>}
     */
    async addNewTrack() {
        const track = new Track();
        await audioEngine.addTrack(track);
        this.renderTrack(track);

        if (this.onTrackAdd) {
            this.onTrackAdd(track);
        }

        return track;
    }

    /**
     * 渲染单个音轨项
     * @param {Track} track - 音轨对象
     */
    renderTrack(track) {
        const trackEl = document.createElement('div');
        trackEl.className = 'track-item';
        trackEl.dataset.trackId = track.id;

        trackEl.innerHTML = `
      <div class="track-header">
        <div class="track-name">
          <span class="track-color" style="background: ${track.color}"></span>
          <span class="track-name-text">${track.name}</span>
        </div>
        <div class="track-controls">
          <button class="track-ctrl-btn mute-btn ${track.muted ? 'active' : ''}" title="静音">M</button>
          <button class="track-ctrl-btn solo-btn ${track.solo ? 'active' : ''}" title="独奏">S</button>
        </div>
      </div>
      <div class="track-volume">
        <input type="range" class="volume-slider" min="0" max="100" value="${Math.round(track.volume * 100)}">
        <span class="volume-value">${Math.round(track.volume * 100)}%</span>
      </div>
    `;

        // 选择音轨
        trackEl.addEventListener('click', (e) => {
            if (!e.target.closest('.track-ctrl-btn') && !e.target.closest('.volume-slider')) {
                this.selectTrack(track.id);
            }
        });

        // 静音按钮
        const muteBtn = trackEl.querySelector('.mute-btn');
        muteBtn.addEventListener('click', () => {
            track.toggleMute();
            muteBtn.classList.toggle('active', track.muted);
            this.handleSoloLogic();
        });

        // 独奏按钮
        const soloBtn = trackEl.querySelector('.solo-btn');
        soloBtn.addEventListener('click', () => {
            track.toggleSolo();
            soloBtn.classList.toggle('active', track.solo);
            this.handleSoloLogic();
        });

        // 音量滑块
        const volumeSlider = trackEl.querySelector('.volume-slider');
        const volumeValue = trackEl.querySelector('.volume-value');

        volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value, 10) / 100;
            track.setVolume(volume);
            volumeValue.textContent = `${e.target.value}%`;

            if (this.onTrackUpdate) {
                this.onTrackUpdate(track);
            }
        });

        this.container.appendChild(trackEl);
    }

    /**
     * 处理独奏逻辑
     * 当有音轨启用独奏时，静音其他非独奏音轨
     */
    handleSoloLogic() {
        const hasSolo = audioEngine.tracks.some(t => t.solo);

        audioEngine.tracks.forEach(track => {
            if (hasSolo) {
                // 有独奏时，非独奏音轨静音
                if (track.gainNode) {
                    track.gainNode.gain.value = track.solo ? track.volume : 0;
                }
            } else {
                // 无独奏时，恢复正常
                if (track.gainNode) {
                    track.gainNode.gain.value = track.muted ? 0 : track.volume;
                }
            }
        });
    }

    /**
     * 选择音轨
     * @param {string} trackId - 音轨 ID
     */
    selectTrack(trackId) {
        // 移除之前的选中状态
        const prevSelected = this.container.querySelector('.track-item.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }

        // 设置新的选中状态
        const trackEl = this.container.querySelector(`[data-track-id="${trackId}"]`);
        if (trackEl) {
            trackEl.classList.add('selected');
            this.selectedTrackId = trackId;

            if (this.onTrackSelect) {
                this.onTrackSelect(audioEngine.getTrack(trackId));
            }
        }
    }

    /**
     * 移除音轨
     * @param {string} trackId - 音轨 ID
     */
    removeTrack(trackId) {
        audioEngine.removeTrack(trackId);

        const trackEl = this.container.querySelector(`[data-track-id="${trackId}"]`);
        if (trackEl) {
            trackEl.remove();
        }

        if (this.selectedTrackId === trackId) {
            this.selectedTrackId = null;
        }
    }

    /**
     * 获取选中的音轨
     * @returns {Track|null}
     */
    getSelectedTrack() {
        if (!this.selectedTrackId) return null;
        return audioEngine.getTrack(this.selectedTrackId);
    }

    /**
     * 更新音轨显示
     * @param {Track} track - 音轨对象
     */
    updateTrackDisplay(track) {
        const trackEl = this.container.querySelector(`[data-track-id="${track.id}"]`);
        if (!trackEl) return;

        const nameText = trackEl.querySelector('.track-name-text');
        const colorDot = trackEl.querySelector('.track-color');

        if (nameText) nameText.textContent = track.name;
        if (colorDot) colorDot.style.background = track.color;
    }
}
