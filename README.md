# AI4AnimationPy Local Controls

This repo now includes a local, browser-based character motion sandbox inspired by the [`facebookresearch/ai4animationpy`](https://github.com/facebookresearch/ai4animationpy) locomotion demos. It does not require Unity or a Python model checkpoint; it gives you an immediately runnable control surface for testing direction, speed, stride, and motion style locally.

## Run locally

```bash
npm run dev
```

Open <http://localhost:5173> in your browser. The npm script uses Python's built-in static file server, so no package install is required.

## Controls

- **Play/Pause**: start or stop the animation loop.
- **Reset**: move the character back to the center and pause playback.
- **Randomize Motion**: pick a random speed, stride, direction, and style.
- **Direction**: rotate the target movement vector from -180° to 180°.
- **Speed**: change locomotion speed from idle to run.
- **Stride**: scale the walk cycle leg swing.
- **Style**: switch between Balanced, Stealth, Athletic, and Robotic profiles.
- **Keyboard**: use `W/A/S/D` or arrow keys to steer, `Space` to pause, and `R` to reset.

## Files

- `index.html` defines the local control UI and animation canvas.
- `styles.css` provides the responsive dark interface.
- `app.js` contains the procedural locomotion loop and keyboard/control bindings.
- `voice-cloner.html` is kept as the previous standalone Web Speech API demo.
