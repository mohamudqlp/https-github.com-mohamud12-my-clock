import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoiceClonerDom } from './helpers.js';

describe('Sky Hopper', () => {
  let page;
  beforeEach(() => { page = createVoiceClonerDom(); });
  afterEach(() => { page.dom.window.close(); });

  it('shows the arcade start screen and saved best score', () => {
    expect(page.window.document.querySelector('#panel-title').textContent).toBe('Sky Hopper');
    expect(page.window.document.querySelector('#start-button').textContent).toBe('START FLYING');
    expect(page.window.document.querySelector('#best').textContent).toBe('0');
  });

  it('starts a new flight and hides the intro panel', () => {
    page.window.skyHopper.startGame();
    expect(page.window.skyHopper.state.running).toBe(true);
    expect(page.window.document.querySelector('#panel').classList.contains('hidden')).toBe(true);
    expect(page.window.document.querySelector('#score').textContent).toBe('0');
  });

  it('flaps only while a flight is active', () => {
    page.window.skyHopper.flap();
    expect(page.window.skyHopper.state.velocity).toBe(0);
    page.window.skyHopper.startGame();
    page.window.skyHopper.flap();
    expect(page.window.skyHopper.state.velocity).toBe(-8.2);
  });
});
