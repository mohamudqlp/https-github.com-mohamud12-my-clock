import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVoiceClonerDom } from './helpers.js';

const voices = [
  { name: 'Alice', lang: 'en-US' },
  { name: 'Bob', lang: 'en-GB' }
];

describe('voice list population', () => {
  let page;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('renders voice labels, index values, and the placeholder option', () => {
    const options = [...page.window.document.querySelector('#voice-select').options];

    expect(options).toHaveLength(3);
    expect(options[0].value).toBe('');
    expect(options[0].textContent).toBe('Select a voice...');
    expect(options.slice(1).map((option) => [option.value, option.textContent])).toEqual([
      ['0', 'Alice (en-US)'],
      ['1', 'Bob (en-GB)']
    ]);
  });

  it('replaces existing options when voices change', () => {
    page.synth.voices = [{ name: 'Clara', lang: 'fr-FR' }];
    page.synth.onvoiceschanged();

    const options = [...page.window.document.querySelector('#voice-select').options];

    expect(options).toHaveLength(2);
    expect(options[1].value).toBe('0');
    expect(options[1].textContent).toBe('Clara (fr-FR)');
  });
});

describe('slider displays', () => {
  let page;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('updates the pitch display on input', () => {
    const pitch = page.window.document.querySelector('#pitch');
    const display = page.window.document.querySelector('#pitch-value');

    pitch.value = '1.7';
    pitch.dispatchEvent(new page.window.Event('input', { bubbles: true }));

    expect(display.textContent).toBe('1.7');
  });

  it('updates the rate display on input', () => {
    const rate = page.window.document.querySelector('#rate');
    const display = page.window.document.querySelector('#rate-value');

    rate.value = '0.8';
    rate.dispatchEvent(new page.window.Event('input', { bubbles: true }));

    expect(display.textContent).toBe('0.8');
  });
});

describe('clone flow validation', () => {
  let page;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('shows an error and does not speak for empty or whitespace-only text', () => {
    const textInput = page.window.document.querySelector('#text-input');
    const cloneButton = page.window.document.querySelector('#clone-btn');
    const status = page.window.document.querySelector('#status');
    const output = page.window.document.querySelector('#output');

    textInput.value = '   ';
    cloneButton.click();

    expect(status.textContent).toBe('Please enter some text!');
    expect(status.className).toBe('status error');
    expect(output.classList.contains('active')).toBe(true);
    expect(page.synth.speak).not.toHaveBeenCalled();
  });

  it('shows an error and does not speak when no voice is selected', () => {
    const textInput = page.window.document.querySelector('#text-input');
    const cloneButton = page.window.document.querySelector('#clone-btn');
    const status = page.window.document.querySelector('#status');
    const output = page.window.document.querySelector('#output');

    textInput.value = 'Hello';
    cloneButton.click();

    expect(status.textContent).toBe('Please select a voice!');
    expect(status.className).toBe('status error');
    expect(output.classList.contains('active')).toBe(true);
    expect(page.synth.speak).not.toHaveBeenCalled();
  });
});

describe('clone flow', () => {
  let page;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('cancels existing speech and speaks a configured utterance', () => {
    const document = page.window.document;
    const textInput = document.querySelector('#text-input');
    const voiceSelect = document.querySelector('#voice-select');
    const pitch = document.querySelector('#pitch');
    const rate = document.querySelector('#rate');
    const cloneButton = document.querySelector('#clone-btn');
    const stopButton = document.querySelector('#stop-btn');
    const status = document.querySelector('#status');

    textInput.value = '  Hello from the test  ';
    voiceSelect.value = '1';
    pitch.value = '1.4';
    rate.value = '0.7';
    cloneButton.click();

    const utterance = page.synth.speak.mock.calls[0][0];

    expect(page.synth.cancel).toHaveBeenCalledTimes(1);
    expect(page.synth.cancel.mock.invocationCallOrder[0])
      .toBeLessThan(page.synth.speak.mock.invocationCallOrder[0]);
    expect(status.textContent).toBe('Cloning voice...');
    expect(status.className).toBe('status');
    expect(cloneButton.disabled).toBe(true);
    expect(stopButton.style.display).toBe('inline-block');
    expect(utterance.text).toBe('Hello from the test');
    expect(utterance.voice).toBe(voices[1]);
    expect(utterance.pitch).toBe(1.4);
    expect(utterance.rate).toBe(0.7);
  });

  it('leaves the utterance voice unset for an out-of-range selected index', () => {
    const document = page.window.document;
    const voiceSelect = document.querySelector('#voice-select');
    const option = document.createElement('option');

    option.value = '5';
    option.textContent = 'Missing voice';
    voiceSelect.appendChild(option);
    voiceSelect.value = '5';
    document.querySelector('#text-input').value = 'Hello';
    document.querySelector('#clone-btn').click();

    const utterance = page.synth.speak.mock.calls[0][0];

    expect(utterance.voice).toBeUndefined();
  });
});

describe('utterance handlers', () => {
  let page;
  let utterance;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
    const document = page.window.document;
    document.querySelector('#voice-select').value = '0';
    document.querySelector('#clone-btn').click();
    utterance = page.synth.speak.mock.calls[0][0];
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('updates the status when synthesis starts', () => {
    const document = page.window.document;
    utterance.onstart();

    expect(document.querySelector('#status').textContent)
      .toBe('🎙️ Voice is being synthesized...');
    expect(document.querySelector('#status').className).toBe('status');
    expect(document.querySelector('#clone-btn').disabled).toBe(true);
    expect(document.querySelector('#stop-btn').style.display).toBe('inline-block');
  });

  it('marks synthesis complete and resets the buttons', () => {
    const document = page.window.document;
    utterance.onend();

    expect(document.querySelector('#status').textContent).toBe('✅ Voice cloning complete!');
    expect(document.querySelector('#status').className).toBe('status success');
    expect(document.querySelector('#clone-btn').disabled).toBe(false);
    expect(document.querySelector('#stop-btn').style.display).toBe('none');
  });

  it('reports synthesis errors and resets the buttons', () => {
    const document = page.window.document;
    utterance.onerror({ error: 'audio-busy' });

    expect(document.querySelector('#status').textContent).toBe('❌ Error: audio-busy');
    expect(document.querySelector('#status').className).toBe('status error');
    expect(document.querySelector('#clone-btn').disabled).toBe(false);
    expect(document.querySelector('#stop-btn').style.display).toBe('none');
  });
});

describe('stop button', () => {
  let page;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
    const document = page.window.document;
    document.querySelector('#voice-select').value = '0';
    document.querySelector('#clone-btn').click();
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('cancels speech and resets the controls', () => {
    const document = page.window.document;
    document.querySelector('#stop-btn').click();

    expect(page.synth.cancel).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#status').textContent).toBe('⏸️ Voice cloning stopped');
    expect(document.querySelector('#status').className).toBe('status');
    expect(document.querySelector('#clone-btn').disabled).toBe(false);
    expect(document.querySelector('#stop-btn').style.display).toBe('none');
  });
});

describe('Enter key handling', () => {
  let page;

  beforeEach(() => {
    page = createVoiceClonerDom(voices);
    page.window.document.querySelector('#voice-select').value = '0';
  });

  afterEach(() => {
    page.dom.window.close();
  });

  it('triggers cloning for the Enter key', () => {
    const textInput = page.window.document.querySelector('#text-input');

    textInput.dispatchEvent(new page.window.KeyboardEvent('keypress', { key: 'Enter' }));

    expect(page.synth.cancel).toHaveBeenCalledTimes(1);
    expect(page.synth.speak).toHaveBeenCalledTimes(1);
  });

  it('does not trigger cloning for a non-Enter key', () => {
    const textInput = page.window.document.querySelector('#text-input');

    textInput.dispatchEvent(new page.window.KeyboardEvent('keypress', { key: 'Tab' }));

    expect(page.synth.cancel).not.toHaveBeenCalled();
    expect(page.synth.speak).not.toHaveBeenCalled();
  });
});
