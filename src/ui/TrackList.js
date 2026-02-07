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

        if (!this.container) {
            console.error('TrackList: container #track-items not found');
        }
        if (!this.btnAddTrack) {
            console.error('TrackList: button #btn-add-track not found');
        }

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
        if (!this.btnAddTrack) return;

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
                if (!this.container) return;

        const trackEl = document.createElement('div');
        trackEl.className = 'track-item';
        trackEl.dataset.trackId = track.id;

                const headerEl = document.createElement('div');
                headerEl.className = 'track-header';

                const nameEl = document.createElement('div');
                nameEl.className = 'track-name';

                const colorEl = document.createElement('span');
                colorEl.className = 'track-color';
                colorEl.style.background = track.color;

                const nameTextEl = document.createElement('span');
                nameTextEl.className = 'track-name-text';
                nameTextEl.textContent = track.name;

                nameEl.appendChild(colorEl);
                nameEl.appendChild(nameTextEl);

                const controlsEl = document.createElement('div');
                controlsEl.className = 'track-controls';

                const muteBtn = document.createElement('button');
                muteBtn.className = `track-ctrl-btn mute-btn${track.muted ? ' active' : ''}`;
                muteBtn.title = '静音';
                muteBtn.type = 'button';
                muteBtn.textContent = 'M';

                const soloBtn = document.createElement('button');
                soloBtn.className = `track-ctrl-btn solo-btn${track.solo ? ' active' : ''}`;
                soloBtn.title = '独奏';
                soloBtn.type = 'button';
                soloBtn.textContent = 'S';

                controlsEl.appendChild(muteBtn);
                controlsEl.appendChild(soloBtn);

                headerEl.appendChild(nameEl);
                headerEl.appendChild(controlsEl);

                const volumeEl = document.createElement('div');
                volumeEl.className = 'track-volume';

                const volumeSlider = document.createElement('input');
                volumeSlider.type = 'range';
                volumeSlider.className = 'volume-slider';
                volumeSlider.min = '0';
                volumeSlider.max = '100';
                volumeSlider.value = String(Math.round(track.volume * 100));

                const volumeValue = document.createElement('span');
                volumeValue.className = 'volume-value';
                volumeValue.textContent = `${Math.round(track.volume * 100)}%`;

                volumeEl.appendChild(volumeSlider);
                volumeEl.appendChild(volumeValue);

                trackEl.appendChild(headerEl);
                trackEl.appendChild(volumeEl);

        // 选择音轨
        trackEl.addEventListener('click', (e) => {
            if (!e.target.closest('.track-ctrl-btn') && !e.target.closest('.volume-slider')) {
                this.selectTrack(track.id);
            }
        });

        // 静音按钮
        muteBtn.addEventListener('click', () => {
            track.toggleMute();
            muteBtn.classList.toggle('active', track.muted);
            this.handleSoloLogic();
        });

        // 独奏按钮
        soloBtn.addEventListener('click', () => {
            track.toggleSolo();
            soloBtn.classList.toggle('active', track.solo);
            this.handleSoloLogic();
        });

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
                // 有独奏时：静音优先，其次独奏保留音量，其他为 0
                if (track.gainNode) {
                    track.gainNode.gain.value = track.muted ? 0 : (track.solo ? track.volume : 0);
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

        this.handleSoloLogic();
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
