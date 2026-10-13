import { render } from 'preact';
import './ui/styles.css';
import { App } from './ui/App';
import { boot } from './app/actions';
import { unlockAudio, warmUp } from './audio/sfx';
import { registerSW, watchVersion } from './app/version';

const root = document.getElementById('app')!;
render(<App />, root);

// iOS only allows audio after a gesture: unlock on the first one.
const unlock = () => {
  unlockAudio();
  warmUp();
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('keydown', unlock, true);
};
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('keydown', unlock, true);

void boot();
registerSW();
watchVersion();
