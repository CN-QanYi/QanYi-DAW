/**
 * QanYi DAW - 主入口文件
 * 初始化应用并协调各组件
 */
import './styles/index.css';
import { audioEngine } from './core/AudioEngine.js';
import { Track } from './core/Track.js';
import { AudioClip } from './core/AudioClip.js';
import { Toolbar } from './ui/Toolbar.js';
import { TrackList } from './ui/TrackList.js';
import { Timeline } from './ui/Timeline.js';
import { Mixer } from './ui/Mixer.js';

class DAWApp {
    constructor() {
        this.toolbar = null;
        this.trackList = null;
        this.timeline = null;
        this.mixer = null;

        // 拖放状态
        this.dropOverlay = document.getElementById('drop-overlay');

        // 剪贴板
        this.clipboard = null;

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        console.log('🎵 QanYi DAW 正在启动...');

        // 初始化 UI 组件
        this.toolbar = new Toolbar();
        this.trackList = new TrackList();
        this.timeline = new Timeline();
        this.mixer = new Mixer();

        // 设置组件间的回调
        this.setupCallbacks();

        // 设置拖放处理
        this.setupDragDrop();

        // 设置键盘快捷键
        this.setupKeyboardShortcuts();

        // 创建默认音轨（音频上下文将在用户首次交互时初始化）
        await this.createDefaultTracks();

        console.log('✅ QanYi DAW 启动完成');
    }

    /**
     * 设置组件回调
     */
    setupCallbacks() {
        // 工具栏文件导入
        this.toolbar.onFileImport = (files) => {
            this.importAudioFiles(files);
        };

        // 音轨列表回调
        this.trackList.onTrackAdd = (track) => {
            this.timeline.addTrack(track);
            this.mixer.addChannel(track);
        };

        this.trackList.onTrackSelect = (track) => {
            console.log('选中音轨:', track.name);
        };

        // 时间线文件拖放
        this.timeline.onFileDrop = (files, trackId, time) => {
            this.importAudioFilesToTrack(files, trackId, time);
        };

        // 片段选择
        this.timeline.onClipSelect = (clip) => {
            console.log('选中片段:', clip.name);
        };

        // 右键菜单操作
        this.timeline.onContextMenuAction = (action, clip) => {
            switch (action) {
                case 'copy':
                    this.copySelectedClip();
                    break;
                case 'cut':
                    this.cutSelectedClip();
                    break;
                case 'duplicate':
                    this.duplicateSelectedClip();
                    break;
                case 'delete':
                    this.timeline.deleteSelectedClip();
                    break;
            }
        };

        // 轨道右键菜单操作
        this.timeline.onTrackContextMenuAction = (action, track, clickTime) => {
            switch (action) {
                case 'paste':
                    this.pasteClipToTrack(track.id, clickTime);
                    break;
                case 'add-track':
                    this.trackList.addNewTrack();
                    break;
                case 'rename-track':
                    this.renameTrack(track);
                    break;
                case 'delete-track':
                    this.deleteTrack(track);
                    break;
            }
        };
    }

    /**
     * 设置拖放处理
     */
    setupDragDrop() {
        let dragCounter = 0;

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (e.dataTransfer.types.includes('Files')) {
                this.dropOverlay.classList.add('active');
            }
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                this.dropOverlay.classList.remove('active');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            this.dropOverlay.classList.remove('active');

            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
            if (files.length > 0) {
                this.importAudioFiles(files);
            }
        });
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 如果焦点在输入框上，不处理快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (audioEngine.isPlaying && !audioEngine.isPaused) {
                        audioEngine.pause();
                    } else {
                        audioEngine.play();
                    }
                    break;

                case 'Enter':
                    e.preventDefault();
                    audioEngine.stop();
                    break;

                case 'Delete':
                case 'Backspace':
                    if (this.timeline.selectedClip) {
                        e.preventDefault();
                        this.timeline.deleteSelectedClip();
                    }
                    break;

                case 'KeyC':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+C 复制
                        e.preventDefault();
                        this.copySelectedClip();
                    }
                    break;

                case 'KeyV':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+V 粘贴
                        e.preventDefault();
                        this.pasteClip();
                    }
                    break;

                case 'KeyX':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+X 剪切
                        e.preventDefault();
                        this.cutSelectedClip();
                    }
                    break;

                case 'KeyD':
                    if (e.ctrlKey || e.metaKey) {
                        // Ctrl+D 复制片段
                        e.preventDefault();
                        this.duplicateSelectedClip();
                    }
                    break;
            }
        });
    }

    /**
     * 复制选中的片段
     */
    copySelectedClip() {
        if (this.timeline.selectedClip) {
            this.clipboard = this.timeline.selectedClip.clone();
            console.log('📋 已复制:', this.clipboard.name);
        }
    }

    /**
     * 剪切选中的片段
     */
    cutSelectedClip() {
        if (this.timeline.selectedClip) {
            this.clipboard = this.timeline.selectedClip.clone();
            this.timeline.deleteSelectedClip();
            console.log('✂️ 已剪切:', this.clipboard.name);
        }
    }

    /**
     * 粘贴片段
     */
    pasteClip() {
        if (!this.clipboard) {
            console.log('❌ 剪贴板为空');
            return;
        }

        const targetTrack = this.trackList.getSelectedTrack() || audioEngine.tracks[0];
        if (!targetTrack) return;

        const newClip = this.clipboard.clone();
        // 粘贴到当前播放位置或音轨末尾
        newClip.setStartTime(audioEngine.currentTime || targetTrack.getDuration());

        targetTrack.addClip(newClip);
        this.timeline.addClip(newClip, targetTrack.id);
        this.timeline.selectClip(newClip);

        console.log('📄 已粘贴:', newClip.name);
    }

    /**
     * 复制片段（在原位置后面）
     */
    duplicateSelectedClip() {
        if (!this.timeline.selectedClip) return;

        const originalClip = this.timeline.selectedClip;
        const track = audioEngine.tracks.find(t => t.id === originalClip.trackId);
        if (!track) return;

        const newClip = originalClip.clone();
        newClip.setStartTime(originalClip.startTime + originalClip.duration);

        track.addClip(newClip);
        this.timeline.addClip(newClip, track.id);
        this.timeline.selectClip(newClip);

        console.log('📑 已复制:', newClip.name);
    }

    /**
     * 创建默认音轨
     */
    async createDefaultTracks() {
        // 创建两个默认音轨
        for (let i = 0; i < 2; i++) {
            await this.trackList.addNewTrack();
        }

        // 选择第一个音轨
        const firstTrack = audioEngine.tracks[0];
        if (firstTrack) {
            this.trackList.selectTrack(firstTrack.id);
        }
    }

    /**
     * 导入音频文件
     * @param {File[]} files - 音频文件列表
     */
    async importAudioFiles(files) {
        // 获取选中的音轨或第一个音轨
        let targetTrack = this.trackList.getSelectedTrack();
        if (!targetTrack && audioEngine.tracks.length > 0) {
            targetTrack = audioEngine.tracks[0];
        }

        if (!targetTrack) {
            targetTrack = await this.trackList.addNewTrack();
        }

        // 计算起始时间（在现有片段之后）
        let startTime = targetTrack.getDuration();

        for (const file of files) {
            try {
                console.log(`正在加载: ${file.name}`);

                const audioBuffer = await audioEngine.loadAudioFile(file);
                const clip = new AudioClip({
                    audioBuffer,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    startTime
                });

                targetTrack.addClip(clip);
                this.timeline.addClip(clip, targetTrack.id);

                startTime += clip.duration + 0.5; // 片段之间留 0.5 秒间隔

                console.log(`✅ 已加载: ${file.name} (${clip.duration.toFixed(2)}秒)`);
            } catch (error) {
                console.error(`❌ 加载失败: ${file.name}`, error);
            }
        }
    }

    /**
     * 导入音频文件到指定音轨
     * @param {File[]} files - 音频文件列表
     * @param {string} trackId - 目标音轨 ID
     * @param {number} time - 起始时间
     */
    async importAudioFilesToTrack(files, trackId, time) {
        const track = audioEngine.getTrack(trackId);
        if (!track) return;

        let startTime = time;

        for (const file of files) {
            try {
                const audioBuffer = await audioEngine.loadAudioFile(file);
                const clip = new AudioClip({
                    audioBuffer,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    startTime
                });

                track.addClip(clip);
                this.timeline.addClip(clip, track.id);

                startTime += clip.duration;

                console.log(`✅ 已添加到 ${track.name}: ${file.name}`);
            } catch (error) {
                console.error(`❌ 加载失败: ${file.name}`, error);
            }
        }
    }

    /**
     * 重命名音轨
     * @param {Track} track - 音轨对象
     */
    renameTrack(track) {
        const newName = prompt('请输入新的音轨名称:', track.name);
        if (newName && newName.trim()) {
            track.setName(newName.trim());
            this.trackList.updateTrackDisplay(track);
            this.mixer.updateChannel(track);
            console.log(`📝 音轨已重命名为: ${track.name}`);
        }
    }

    /**
     * 删除音轨
     * @param {Track} track - 音轨对象
     */
    deleteTrack(track) {
        if (audioEngine.tracks.length <= 1) {
            alert('至少需要保留一个音轨！');
            return;
        }

        if (confirm(`确定要删除音轨 "${track.name}" 吗？\n音轨上的所有音频片段也将被删除。`)) {
            // 从时间线移除所有片段
            track.clips.forEach(clip => {
                const clipEl = this.timeline.clipElements.get(clip.id);
                if (clipEl) {
                    clipEl.remove();
                    this.timeline.clipElements.delete(clip.id);
                }
            });

            // 移除音轨
            this.timeline.removeTrack(track.id);
            this.trackList.removeTrack(track.id);
            this.mixer.removeChannel(track.id);

            console.log(`🗑️ 已删除音轨: ${track.name}`);
        }
    }

    /**
     * 粘贴片段到指定音轨
     * @param {string} trackId - 目标音轨 ID
     * @param {number} time - 粘贴位置时间
     */
    pasteClipToTrack(trackId, time) {
        if (!this.clipboard) {
            console.log('⚠️ 剪贴板为空');
            return;
        }

        const track = audioEngine.getTrack(trackId);
        if (!track) return;

        const newClip = this.clipboard.clone();
        newClip.setStartTime(time);

        track.addClip(newClip);
        this.timeline.addClip(newClip, track.id);

        console.log(`📋 已粘贴: ${newClip.name} 到 ${track.name}`);
    }
}

// 启动应用
new DAWApp();

