class AudioManager {
    constructor() {
        this.audioContext = null;
        this.soundBuffers = {};
        this.sounds = {
            sword: '/roblox-sword-lunge-made-with-Voicemod (1).mp3',
            rocket_launch: '/rocket_launch.mp3',
            explosion: '/explosion.mp3',
            the_great_strategy: '/The Great Strategy (2005) Roblox Theme 2006 [ ezmp3.mp3',
            explore_roblox: '/Explore roblox.mp3'
        };
        this.activeSources = {};
        this.init();
    }

    async init() {
        try {
            // Wait for a user interaction to create the AudioContext
            const userInteractionHandler = async () => {
                if (this.audioContext) return;
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    await this.loadSounds();
                } catch (e) {
                    console.error("Web Audio API is not supported in this browser.", e);
                }
                document.body.removeEventListener('click', userInteractionHandler);
                document.body.removeEventListener('keydown', userInteractionHandler);
            };
            document.body.addEventListener('click', userInteractionHandler, { once: true });
            document.body.addEventListener('keydown', userInteractionHandler, { once: true });

        } catch (e) {
            console.error("Error setting up AudioContext:", e);
        }
    }

    async loadSound(name, url) {
        if (!this.audioContext) return;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers[name] = audioBuffer;
        } catch (e) {
            console.error(`Error loading sound: ${name}`, e);
        }
    }

    async loadSounds() {
        const promises = [];
        for (const key in this.sounds) {
            promises.push(this.loadSound(key, this.sounds[key]));
        }
        await Promise.all(promises);
    }

    playSound(name, { loop = false, volume = 1 } = {}) {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Avoid starting the same named sound multiple times (idempotent play)
        if (this.activeSources[name]) {
            // If already playing, ensure looping/value updated and return
            this.activeSources[name].gain.gain.value = volume;
            if (this.activeSources[name].source) this.activeSources[name].source.loop = !!loop;
            return;
        }

        if (this.audioContext && this.soundBuffers[name]) {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.soundBuffers[name];
            source.loop = !!loop;

            const gain = this.audioContext.createGain();
            gain.gain.value = volume;

            source.connect(gain);
            gain.connect(this.audioContext.destination);
            source.start(0);

            // store so we can stop if needed
            this.activeSources[name] = { source, gain };
            source.onended = () => {
                if (!source.loop) delete this.activeSources[name];
            };
        } else if (!this.audioContext) {
            console.warn(`AudioContext not ready. Sound "${name}" not played.`);
        }
    }

    stopSound(name) {
        const entry = this.activeSources[name];
        if (entry && entry.source) {
            try {
                entry.source.stop(0);
            } catch (e) { /* ignore stop errors */ }
            delete this.activeSources[name];
        }
    }
}

export const audioManager = new AudioManager();