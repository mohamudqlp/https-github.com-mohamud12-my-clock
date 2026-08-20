const PITCH_PROCESSOR_SOURCE = `
class PitchProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
    }

    constructor() {
        super();
        this.size = 8192;
        this.grain = 2048;
        this.buffers = [];
        this.writeIndex = 0;
        this.phase = 0;
    }

    sample(buffer, position) {
        let p = position % this.size;
        if (p < 0) p += this.size;
        const i0 = Math.floor(p);
        const i1 = (i0 + 1) % this.size;
        const frac = p - i0;
        return buffer[i0] * (1 - frac) + buffer[i1] * frac;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || input.length === 0) return true;

        while (this.buffers.length < output.length) {
            this.buffers.push(new Float32Array(this.size));
        }

        const ratio = parameters.ratio[0];
        const grain = this.grain;
        const frames = output[0].length;
        let writeIndex = this.writeIndex;
        let phase = this.phase;

        for (let channel = 0; channel < output.length; channel += 1) {
            const inChannel = input[Math.min(channel, input.length - 1)];
            const buffer = this.buffers[channel];
            const outChannel = output[channel];
            writeIndex = this.writeIndex;
            phase = this.phase;

            for (let i = 0; i < frames; i += 1) {
                buffer[writeIndex] = inChannel ? inChannel[i] : 0;

                if (Math.abs(ratio - 1) < 1e-4) {
                    outChannel[i] = buffer[writeIndex];
                } else {
                    const phaseB = (phase + 0.5) % 1;
                    const windowA = Math.sin(Math.PI * phase);
                    const windowB = Math.sin(Math.PI * phaseB);
                    outChannel[i] =
                        windowA * windowA * this.sample(buffer, writeIndex - phase * grain) +
                        windowB * windowB * this.sample(buffer, writeIndex - phaseB * grain);
                }

                phase += (1 - ratio) / grain;
                if (phase >= 1) phase -= 1;
                else if (phase < 0) phase += 1;
                writeIndex = (writeIndex + 1) % this.size;
            }
        }

        this.writeIndex = writeIndex;
        this.phase = phase;
        return true;
    }
}

registerProcessor('pitch-processor', PitchProcessor);
`;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const stage = document.getElementById('stage');
const video = document.getElementById('video');
const fileNameEl = document.getElementById('file-name');
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const muteBtn = document.getElementById('mute-btn');
const muteIcon = document.getElementById('mute-icon');
const seek = document.getElementById('seek');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');
const pitchSlider = document.getElementById('pitch');
const pitchValue = document.getElementById('pitch-value');
const preservePitch = document.getElementById('preserve-pitch');
const resetBtn = document.getElementById('reset-btn');
const changeBtn = document.getElementById('change-btn');
const statusEl = document.getElementById('status');

let objectUrl = null;
let audioContext = null;
let pitchNode = null;
let audioGraphReady = false;
let scrubbing = false;

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function semitonesToRatio(semitones) {
    return Math.pow(2, semitones / 12);
}

function markActiveChips(container, matches) {
    container.querySelectorAll('.chip').forEach((chip) => {
        chip.classList.toggle('active', matches(chip));
    });
}

function syncSpeedUi() {
    const rate = Number(speedSlider.value);
    speedValue.textContent = `${rate.toFixed(2)}\u00d7`;
    markActiveChips(speedSlider.parentElement, (chip) => Number(chip.dataset.speed) === rate);
}

function syncPitchUi() {
    const semitones = Number(pitchSlider.value);
    pitchValue.textContent = `${semitones > 0 ? '+' : ''}${semitones} st`;
    markActiveChips(pitchSlider.parentElement, (chip) => Number(chip.dataset.pitch) === semitones);
}

function applySpeed() {
    video.playbackRate = Number(speedSlider.value);
    syncSpeedUi();
}

function applyPitch() {
    syncPitchUi();
    if (!pitchNode) return;
    pitchNode.parameters.get('ratio').value = semitonesToRatio(Number(pitchSlider.value));
}

function applyPreservePitch() {
    const keep = preservePitch.checked;
    video.preservesPitch = keep;
    video.mozPreservesPitch = keep;
    video.webkitPreservesPitch = keep;
}

async function setupAudioGraph() {
    if (audioGraphReady) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
        setStatus('This browser has no Web Audio support, so pitch shifting is unavailable.', true);
        pitchSlider.disabled = true;
        audioGraphReady = true;
        return;
    }

    audioContext = new AudioContextCtor();
    const source = audioContext.createMediaElementSource(video);

    if (!audioContext.audioWorklet) {
        source.connect(audioContext.destination);
        pitchSlider.disabled = true;
        setStatus('Pitch shifting needs AudioWorklet, which this browser lacks. Speed still works.', true);
        audioGraphReady = true;
        return;
    }

    try {
        const blob = new Blob([PITCH_PROCESSOR_SOURCE], { type: 'application/javascript' });
        const moduleUrl = URL.createObjectURL(blob);
        await audioContext.audioWorklet.addModule(moduleUrl);
        URL.revokeObjectURL(moduleUrl);
        pitchNode = new AudioWorkletNode(audioContext, 'pitch-processor');
        source.connect(pitchNode).connect(audioContext.destination);
        applyPitch();
    } catch (error) {
        source.connect(audioContext.destination);
        pitchSlider.disabled = true;
        setStatus(`Pitch shifting could not start: ${error.message}`, true);
    }

    audioGraphReady = true;
}

async function ensureAudioRunning() {
    await setupAudioGraph();
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (error) {
            setStatus(`Audio could not be resumed: ${error.message}`, true);
        }
    }
}

function loadFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('video/')) {
        setStatus(`"${file.name}" is not a video file.`, true);
        return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    fileNameEl.textContent = file.name;
    stage.hidden = false;
    dropzone.hidden = true;
    setStatus('Loading video\u2026');
    video.load();
}

fileInput.addEventListener('change', (event) => {
    loadFile(event.target.files[0]);
    event.target.value = '';
});

['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, () => dropzone.classList.remove('dragover'));
});

dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    loadFile(event.dataTransfer.files[0]);
});

video.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(video.duration);
    seek.max = Number.isFinite(video.duration) ? video.duration : 0;
    seek.value = 0;
    applySpeed();
    applyPreservePitch();
    setStatus('Ready to play.');
});

video.addEventListener('error', () => {
    setStatus('This file could not be decoded. Try a different video.', true);
});

video.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = formatTime(video.currentTime);
    if (!scrubbing) seek.value = video.currentTime;
});

video.addEventListener('play', () => {
    playIcon.textContent = '\u23f8';
    playBtn.setAttribute('aria-label', 'Pause');
});

video.addEventListener('pause', () => {
    playIcon.textContent = '\u25b6';
    playBtn.setAttribute('aria-label', 'Play');
});

video.addEventListener('ended', () => setStatus('Playback finished.'));

playBtn.addEventListener('click', async () => {
    if (video.paused) {
        await ensureAudioRunning();
        try {
            await video.play();
            setStatus('Playing.');
        } catch (error) {
            setStatus(`Playback was blocked: ${error.message}`, true);
        }
    } else {
        video.pause();
        setStatus('Paused.');
    }
});

muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    muteIcon.textContent = video.muted ? '\ud83d\udd07' : '\ud83d\udd0a';
    muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
});

seek.addEventListener('pointerdown', () => { scrubbing = true; });
seek.addEventListener('pointerup', () => { scrubbing = false; });
seek.addEventListener('input', () => {
    scrubbing = true;
    currentTimeEl.textContent = formatTime(Number(seek.value));
});
seek.addEventListener('change', () => {
    video.currentTime = Number(seek.value);
    scrubbing = false;
});

speedSlider.addEventListener('input', applySpeed);
pitchSlider.addEventListener('input', applyPitch);
preservePitch.addEventListener('change', applyPreservePitch);

document.querySelectorAll('.chip[data-speed]').forEach((chip) => {
    chip.addEventListener('click', () => {
        speedSlider.value = chip.dataset.speed;
        applySpeed();
    });
});

document.querySelectorAll('.chip[data-pitch]').forEach((chip) => {
    chip.addEventListener('click', () => {
        pitchSlider.value = chip.dataset.pitch;
        applyPitch();
    });
});

resetBtn.addEventListener('click', () => {
    speedSlider.value = '1';
    pitchSlider.value = '0';
    preservePitch.checked = true;
    applySpeed();
    applyPitch();
    applyPreservePitch();
    setStatus('Speed and pitch reset.');
});

changeBtn.addEventListener('click', () => fileInput.click());

document.addEventListener('keydown', (event) => {
    if (stage.hidden) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (event.code === 'Space') {
        event.preventDefault();
        playBtn.click();
    } else if (event.code === 'ArrowRight') {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    } else if (event.code === 'ArrowLeft') {
        video.currentTime = Math.max(0, video.currentTime - 5);
    }
});

window.addEventListener('beforeunload', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
});

syncSpeedUi();
syncPitchUi();
