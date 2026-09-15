import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../voice-cloner.html', import.meta.url), 'utf8');

export function createVoiceClonerDom() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true,
    beforeParse(window) {
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
    }
  });
  return { dom, window: dom.window };
}
