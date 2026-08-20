import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const html = readFileSync(new URL('../voice-cloner.html', import.meta.url), 'utf8');
const videoHtml = readFileSync(new URL('../video-player.html', import.meta.url), 'utf8');
const videoCss = readFileSync(new URL('../video-player.css', import.meta.url), 'utf8');
const videoJs = readFileSync(new URL('../video-player.js', import.meta.url), 'utf8');

export function createVoiceClonerDom(voices = []) {
  const synth = {
    voices,
    getVoices: vi.fn(() => synth.voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    onvoiceschanged: null
  };

  class FakeSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
    }
  }

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(window) {
      window.speechSynthesis = synth;
      window.SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
    }
  });

  return { dom, window: dom.window, synth };
}

export function createVideoPlayerDom({
  audioWorklet = true,
  addModuleError = null,
  playError = null,
  playPending = false
} = {}) {
  const pageHtml = videoHtml
    .replace('<link rel="stylesheet" href="video-player.css">', `<style>${videoCss}</style>`)
    .replace('<script src="video-player.js"></script>', `<script>${videoJs}</script>`);
  const mediaState = new WeakMap();
  const createObjectURL = vi.fn(() => `blob:test-${createObjectURL.mock.calls.length}`);
  const revokeObjectURL = vi.fn();
  const audioWorkletApi = {
    addModule: vi.fn(() => addModuleError
      ? Promise.reject(addModuleError)
      : Promise.resolve())
  };
  const audioGraph = {
    contexts: [],
    nodes: [],
    source: null,
    ratioParam: { value: 1 }
  };
  const destination = {};
  let resolvePlay;

  const source = {
    connect: vi.fn((node) => node)
  };
  audioGraph.source = source;

  const media = {
    play: vi.fn(function() {
      if (playError) return Promise.reject(playError);
      mediaState.get(this).paused = false;
      this.dispatchEvent(new this.ownerDocument.defaultView.Event('play'));
      if (playPending) {
        return new Promise((resolve) => {
          resolvePlay = resolve;
        });
      }
      return Promise.resolve();
    }),
    pause: vi.fn(function() {
      mediaState.get(this).paused = true;
      this.dispatchEvent(new this.ownerDocument.defaultView.Event('pause'));
    }),
    load: vi.fn()
  };

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.destination = destination;
      this.audioWorklet = audioWorklet ? audioWorkletApi : undefined;
      this.createMediaElementSource = vi.fn(() => source);
      this.resume = vi.fn(async () => {
        this.state = 'running';
      });
      audioGraph.contexts.push(this);
    }
  }

  class FakeAudioWorkletNode {
    constructor(context, name) {
      this.context = context;
      this.name = name;
      this.parameters = new Map([['ratio', audioGraph.ratioParam]]);
      this.connect = vi.fn(() => destination);
      audioGraph.nodes.push(this);
    }
  }

  const dom = new JSDOM(pageHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(window) {
      const stateFor = (element) => {
        if (!mediaState.has(element)) {
          mediaState.set(element, {
            paused: true,
            duration: NaN,
            currentTime: 0,
            playbackRate: 1,
            preservesPitch: true,
            mozPreservesPitch: true,
            webkitPreservesPitch: true,
            muted: false
          });
        }
        return mediaState.get(element);
      };
      const mediaPrototype = window.HTMLMediaElement.prototype;

      Object.defineProperties(mediaPrototype, {
        paused: {
          configurable: true,
          get() {
            return stateFor(this).paused;
          },
          set(value) {
            stateFor(this).paused = value;
          }
        },
        duration: {
          configurable: true,
          get() {
            return stateFor(this).duration;
          },
          set(value) {
            stateFor(this).duration = value;
          }
        },
        currentTime: {
          configurable: true,
          get() {
            return stateFor(this).currentTime;
          },
          set(value) {
            stateFor(this).currentTime = value;
          }
        },
        playbackRate: {
          configurable: true,
          get() {
            return stateFor(this).playbackRate;
          },
          set(value) {
            stateFor(this).playbackRate = value;
          }
        },
        preservesPitch: {
          configurable: true,
          get() {
            return stateFor(this).preservesPitch;
          },
          set(value) {
            stateFor(this).preservesPitch = value;
          }
        },
        mozPreservesPitch: {
          configurable: true,
          get() {
            return stateFor(this).mozPreservesPitch;
          },
          set(value) {
            stateFor(this).mozPreservesPitch = value;
          }
        },
        webkitPreservesPitch: {
          configurable: true,
          get() {
            return stateFor(this).webkitPreservesPitch;
          },
          set(value) {
            stateFor(this).webkitPreservesPitch = value;
          }
        },
        muted: {
          configurable: true,
          get() {
            return stateFor(this).muted;
          },
          set(value) {
            stateFor(this).muted = value;
          }
        },
        play: {
          configurable: true,
          value: media.play
        },
        pause: {
          configurable: true,
          value: media.pause
        },
        load: {
          configurable: true,
          value: media.load
        }
      });

      Object.defineProperty(window.URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURL
      });
      Object.defineProperty(window.URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURL
      });
      window.AudioContext = FakeAudioContext;
      window.webkitAudioContext = undefined;
      window.AudioWorkletNode = FakeAudioWorkletNode;
    }
  });

  return {
    dom,
    window: dom.window,
    media,
    audioGraph,
    audioWorklet: audioWorkletApi,
    createObjectURL,
    revokeObjectURL,
    resolvePlay: () => resolvePlay?.()
  };
}

export function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
