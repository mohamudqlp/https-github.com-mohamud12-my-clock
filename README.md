# Voice Cloner App

A browser-based voice cloning demo app.

## Features
- Record a short microphone sample in the browser
- Analyze sample pitch/energy to build a basic voice profile
- Generate "cloned" speech with browser text-to-speech using suggested pitch/rate
- Tune pitch/rate manually and replay generated speech

## Run locally
Open `voice-cloner.html` directly in a browser, or serve this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/voice-cloner.html`.

## Notes
This is an approximation built entirely with browser APIs (`MediaRecorder`, `Web Audio`, and `SpeechSynthesis`).
It does not perform true neural voice cloning.
