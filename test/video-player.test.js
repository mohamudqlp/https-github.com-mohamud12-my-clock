import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVideoPlayerDom, flushMicrotasks } from './helpers.js';

function getElements(page) {
  const { document } = page.window;
  return {
    dropzone: document.querySelector('#dropzone'),
    fileInput: document.querySelector('#file-input'),
    stage: document.querySelector('#stage'),
    video: document.querySelector('#video'),
    fileName: document.querySelector('#file-name'),
    playButton: document.querySelector('#play-btn'),
    playIcon: document.querySelector('#play-icon'),
    muteButton: document.querySelector('#mute-btn'),
    muteIcon: document.querySelector('#mute-icon'),
    seek: document.querySelector('#seek'),
    currentTime: document.querySelector('#current-time'),
    duration: document.querySelector('#duration'),
    speed: document.querySelector('#speed'),
    speedValue: document.querySelector('#speed-value'),
    pitch: document.querySelector('#pitch'),
    pitchValue: document.querySelector('#pitch-value'),
    preservePitch: document.querySelector('#preserve-pitch'),
    resetButton: document.querySelector('#reset-btn'),
    status: document.querySelector('#status')
  };
}

function createFile(page, name = 'sample.mp4', type = 'video/mp4') {
  return new page.window.File(['video bytes'], name, { type });
}

function chooseFile(page, file = createFile(page)) {
  const { fileInput } = getElements(page);
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [file]
  });
  fileInput.dispatchEvent(new page.window.Event('change', { bubbles: true }));
  return file;
}

function dropFile(page, file = createFile(page, 'dropped.webm', 'video/webm')) {
  const { dropzone } = getElements(page);
  const event = new page.window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  dropzone.dispatchEvent(event);
  return file;
}

function importVideoAndSetMedia(page, duration = 120) {
  chooseFile(page);
  const { video } = getElements(page);
  video.duration = duration;
  video.dispatchEvent(new page.window.Event('loadedmetadata'));
  return video;
}

async function startPlayback(page) {
  const { playButton } = getElements(page);
  playButton.click();
  await flushMicrotasks();
}

describe('initial state and time formatting', () => {
  let page;

  beforeEach(() => {
    page = createVideoPlayerDom();
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('keeps the stage hidden before import even with the stage flex rule', () => {
    const { stage } = getElements(page);

    expect(stage.hidden).toBe(true);
    expect(page.window.getComputedStyle(stage).display).toBe('none');
  });

  it.each([
    [0, 0, '0:00', '0:00'],
    [5.8, 4.2, '0:05', '0:04'],
    [61.9, 75.2, '1:01', '1:15']
  ])('formats duration %s and current time %s', (duration, current, expectedDuration, expectedCurrent) => {
    const video = importVideoAndSetMedia(page, duration);
    const { currentTime, duration: durationLabel } = getElements(page);

    video.currentTime = current;
    video.dispatchEvent(new page.window.Event('timeupdate'));

    expect(durationLabel.textContent).toBe(expectedDuration);
    expect(currentTime.textContent).toBe(expectedCurrent);
  });

  it('uses 0:00 for a non-finite duration', () => {
    importVideoAndSetMedia(page, Infinity);

    const { duration, seek } = getElements(page);

    expect(duration.textContent).toBe('0:00');
    expect(seek.max).toBe('0');
  });
});

describe('video import', () => {
  let page;

  beforeEach(() => {
    page = createVideoPlayerDom();
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('reveals the stage, hides the dropzone, names the file, and creates an object URL', () => {
    const file = chooseFile(page, createFile(page, 'concert.mp4'));
    const { stage, dropzone, fileName, video } = getElements(page);

    expect(stage.hidden).toBe(false);
    expect(dropzone.hidden).toBe(true);
    expect(fileName.textContent).toBe('concert.mp4');
    expect(page.createObjectURL).toHaveBeenCalledWith(file);
    expect(video.src).toBe('blob:test-1');
    expect(page.media.load).toHaveBeenCalledTimes(1);
  });

  it('reports non-video files without changing the source', () => {
    const { video, status } = getElements(page);
    const sourceBefore = video.src;

    chooseFile(page, createFile(page, 'notes.txt', 'text/plain'));

    expect(status.textContent).toBe('"notes.txt" is not a video file.');
    expect(status.classList.contains('error')).toBe(true);
    expect(video.src).toBe(sourceBefore);
    expect(page.createObjectURL).not.toHaveBeenCalled();
    expect(page.media.load).not.toHaveBeenCalled();
  });

  it('marks dragover state and loads a dropped video', () => {
    const { dropzone, stage, fileName } = getElements(page);
    const dragover = new page.window.Event('dragover', { bubbles: true, cancelable: true });

    dropzone.dispatchEvent(dragover);
    expect(dropzone.classList.contains('dragover')).toBe(true);

    dropFile(page);

    expect(dropzone.classList.contains('dragover')).toBe(false);
    expect(stage.hidden).toBe(false);
    expect(fileName.textContent).toBe('dropped.webm');
  });
});

describe('speed and pitch controls', () => {
  let page;

  beforeEach(() => {
    page = createVideoPlayerDom();
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('updates playback speed and formats the multiplication sign', () => {
    const { speed, speedValue, video } = getElements(page);

    speed.value = '2';
    speed.dispatchEvent(new page.window.Event('input'));

    expect(video.playbackRate).toBe(2);
    expect(speedValue.textContent).toBe('2.00×');
  });

  it('makes only the selected speed chip active', () => {
    const { speed, speedValue } = getElements(page);
    const chips = [...page.window.document.querySelectorAll('.chip[data-speed]')];

    chips[2].click();

    expect(speed.value).toBe('1.5');
    expect(speedValue.textContent).toBe('1.50×');
    expect(chips.filter((chip) => chip.classList.contains('active'))).toEqual([chips[2]]);
  });

  it('formats pitch values and writes the worklet ratio', async () => {
    await startPlayback(page);
    const { pitch, pitchValue } = getElements(page);

    pitch.value = '7';
    pitch.dispatchEvent(new page.window.Event('input'));
    expect(pitchValue.textContent).toBe('+7 st');
    expect(page.audioGraph.ratioParam.value).toBeCloseTo(2 ** (7 / 12));

    pitch.value = '-5';
    pitch.dispatchEvent(new page.window.Event('input'));
    expect(pitchValue.textContent).toBe('-5 st');
    expect(page.audioGraph.ratioParam.value).toBeCloseTo(2 ** (-5 / 12));
  });

  it('applies pitch presets and makes only the selected pitch chip active', async () => {
    await startPlayback(page);
    const chips = [...page.window.document.querySelectorAll('.chip[data-pitch]')];
    const selected = chips.find((chip) => chip.dataset.pitch === '0');
    const { pitch, pitchValue } = getElements(page);

    chips.find((chip) => chip.dataset.pitch === '7').click();

    expect(pitch.value).toBe('7');
    expect(pitchValue.textContent).toBe('+7 st');
    expect(page.audioGraph.ratioParam.value).toBeCloseTo(2 ** (7 / 12));
    expect(chips.filter((chip) => chip.classList.contains('active'))).toEqual([
      chips.find((chip) => chip.dataset.pitch === '7')
    ]);
    expect(selected.classList.contains('active')).toBe(false);
  });

  it('toggles preserve-pitch media properties', () => {
    const { preservePitch, video } = getElements(page);

    preservePitch.checked = false;
    preservePitch.dispatchEvent(new page.window.Event('change'));
    expect(video.preservesPitch).toBe(false);
    expect(video.mozPreservesPitch).toBe(false);
    expect(video.webkitPreservesPitch).toBe(false);

    preservePitch.checked = true;
    preservePitch.dispatchEvent(new page.window.Event('change'));
    expect(video.preservesPitch).toBe(true);
    expect(video.mozPreservesPitch).toBe(true);
    expect(video.webkitPreservesPitch).toBe(true);
  });
});

describe('audio graph and playback', () => {
  let page;

  beforeEach(() => {
    page = createVideoPlayerDom();
    importVideoAndSetMedia(page);
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('builds the audio graph once across play and pause cycles and resumes suspended audio', async () => {
    const { playButton } = getElements(page);

    await startPlayback(page);
    playButton.click();
    await flushMicrotasks();
    await startPlayback(page);

    expect(page.audioGraph.contexts).toHaveLength(1);
    expect(page.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(page.audioGraph.contexts[0].resume).toHaveBeenCalledTimes(1);
    expect(page.audioGraph.nodes).toHaveLength(1);
  });

  it('surfaces a rejected play as a blocked playback error', async () => {
    page.dom.window.close();
    page = createVideoPlayerDom({ playError: new Error('autoplay denied') });
    importVideoAndSetMedia(page);

    await startPlayback(page);

    const { status } = getElements(page);
    expect(status.textContent).toBe('Playback was blocked: autoplay denied');
    expect(status.classList.contains('error')).toBe(true);
  });

  it('disables pitch on module failure while retaining speed control', async () => {
    page.dom.window.close();
    page = createVideoPlayerDom({
      addModuleError: new Error('module failed'),
      playPending: true
    });
    importVideoAndSetMedia(page);

    getElements(page).playButton.click();
    await flushMicrotasks();

    const { pitch, speed, status, video } = getElements(page);
    expect(pitch.disabled).toBe(true);
    expect(status.textContent).toBe('Pitch shifting could not start: module failed');
    expect(status.classList.contains('error')).toBe(true);

    speed.value = '1.5';
    speed.dispatchEvent(new page.window.Event('input'));
    expect(video.playbackRate).toBe(1.5);
    page.resolvePlay();
  });

  it('disables pitch without AudioWorklet while retaining speed control', async () => {
    page.dom.window.close();
    page = createVideoPlayerDom({ audioWorklet: false });
    importVideoAndSetMedia(page);

    getElements(page).playButton.click();
    await Promise.resolve();

    const { pitch, speed, status, video } = getElements(page);
    expect(pitch.disabled).toBe(true);
    expect(status.textContent)
      .toBe('Pitch shifting needs AudioWorklet, which this browser lacks. Speed still works.');

    speed.value = '0.5';
    speed.dispatchEvent(new page.window.Event('input'));
    expect(video.playbackRate).toBe(0.5);
  });

  it('updates play and pause controls from media events', () => {
    const { video, playButton, playIcon } = getElements(page);

    video.dispatchEvent(new page.window.Event('play'));
    expect(playIcon.textContent).toBe('⏸');
    expect(playButton.getAttribute('aria-label')).toBe('Pause');

    video.dispatchEvent(new page.window.Event('pause'));
    expect(playIcon.textContent).toBe('▶');
    expect(playButton.getAttribute('aria-label')).toBe('Play');
  });

  it('sets statuses for ended and media error events', () => {
    const { video, status } = getElements(page);

    video.dispatchEvent(new page.window.Event('ended'));
    expect(status.textContent).toBe('Playback finished.');

    video.dispatchEvent(new page.window.Event('error'));
    expect(status.textContent).toBe('This file could not be decoded. Try a different video.');
    expect(status.classList.contains('error')).toBe(true);
  });
});

describe('transport, seek, reset, and keyboard controls', () => {
  let page;

  beforeEach(() => {
    page = createVideoPlayerDom();
    importVideoAndSetMedia(page, 30);
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('toggles mute state, icon, and label', () => {
    const { muteButton, muteIcon, video } = getElements(page);

    muteButton.click();
    expect(video.muted).toBe(true);
    expect(muteIcon.textContent).toBe('🔇');
    expect(muteButton.getAttribute('aria-label')).toBe('Unmute');

    muteButton.click();
    expect(video.muted).toBe(false);
    expect(muteIcon.textContent).toBe('🔊');
    expect(muteButton.getAttribute('aria-label')).toBe('Mute');
  });

  it('updates the seek label while scrubbing and commits on change', () => {
    const { currentTime, seek, video } = getElements(page);
    video.currentTime = 10;
    seek.value = '20';
    seek.dispatchEvent(new page.window.Event('input'));

    expect(currentTime.textContent).toBe('0:20');
    expect(video.currentTime).toBe(10);

    seek.dispatchEvent(new page.window.Event('change'));
    expect(video.currentTime).toBe(20);
  });

  it('resets speed, pitch, preserve-pitch, and media properties', async () => {
    await startPlayback(page);
    const { speed, pitch, preservePitch, resetButton, video } = getElements(page);

    speed.value = '2';
    speed.dispatchEvent(new page.window.Event('input'));
    pitch.value = '7';
    pitch.dispatchEvent(new page.window.Event('input'));
    preservePitch.checked = false;
    preservePitch.dispatchEvent(new page.window.Event('change'));
    resetButton.click();

    expect(speed.value).toBe('1');
    expect(pitch.value).toBe('0');
    expect(preservePitch.checked).toBe(true);
    expect(video.playbackRate).toBe(1);
    expect(video.preservesPitch).toBe(true);
    expect(video.mozPreservesPitch).toBe(true);
    expect(video.webkitPreservesPitch).toBe(true);
    expect(page.audioGraph.ratioParam.value).toBeCloseTo(1);
  });

  it('uses Space for play toggling only on the visible stage and outside controls', async () => {
    page.dom.window.close();
    page = createVideoPlayerDom();
    const { playButton, fileInput } = getElements(page);
    const hiddenStageSpace = new page.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    page.window.document.body.dispatchEvent(hiddenStageSpace);
    expect(page.media.play).not.toHaveBeenCalled();

    importVideoAndSetMedia(page);
    page.window.document.body.dispatchEvent(
      new page.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true })
    );
    await flushMicrotasks();
    expect(page.media.play).toHaveBeenCalledTimes(1);

    fileInput.dispatchEvent(new page.window.KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true
    }));
    expect(page.media.pause).not.toHaveBeenCalled();

    playButton.dispatchEvent(new page.window.KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true
    }));
    expect(page.media.pause).not.toHaveBeenCalled();
  });

  it('seeks five seconds with arrows and clamps to the media bounds', () => {
    const { video } = getElements(page);
    video.currentTime = 28;
    page.window.document.body.dispatchEvent(
      new page.window.KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true })
    );
    expect(video.currentTime).toBe(30);

    video.currentTime = 2;
    page.window.document.body.dispatchEvent(
      new page.window.KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true })
    );
    expect(video.currentTime).toBe(0);
  });
});
