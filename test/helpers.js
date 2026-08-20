import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const html = readFileSync(new URL('../voice-cloner.html', import.meta.url), 'utf8');

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
