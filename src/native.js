import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

export const isNative = Capacitor.isNativePlatform();

// Android System WebView has no Web Speech API; this adapter exposes the same
// surface DrivingMode already uses (lang, onstart/onresult/onerror/onend, start/stop/abort).
class NativeSpeechRecognition {
  constructor() {
    this.lang = 'en-IN';
    this._aborted = false;
  }

  start() {
    this._aborted = false;
    this._run();
  }

  stop() {
    NativeSpeech.stop().catch(() => {});
  }

  abort() {
    this._aborted = true;
    this.stop();
  }

  _emit(name, payload) {
    if (!this._aborted) this[name]?.(payload);
  }

  async _run() {
    try {
      const { available } = await NativeSpeech.available();
      if (!available) {
        this._emit('onerror', { error: 'service-not-allowed' });
        return;
      }
      let perm = await NativeSpeech.checkPermissions();
      if (perm.speechRecognition !== 'granted') perm = await NativeSpeech.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        this._emit('onerror', { error: 'not-allowed' });
        return;
      }
      this._emit('onstart');
      const { matches } = await NativeSpeech.start({
        language: this.lang,
        maxResults: 1,
        partialResults: false,
        popup: false,
      });
      if (matches && matches.length) {
        this._emit('onresult', { results: [[{ transcript: matches[0] }]] });
      } else {
        this._emit('onerror', { error: 'no-speech' });
      }
    } catch (e) {
      const msg = String(e?.message || e);
      let error = msg;
      if (/no match|timeout|no speech|didn't understand/i.test(msg)) error = 'no-speech';
      else if (/network/i.test(msg)) error = 'network';
      this._emit('onerror', { error });
    } finally {
      this._emit('onend');
    }
  }
}

// Maps navigator.vibrate(pattern) onto the Haptics plugin so existing call sites keep working.
function polyfillVibrate() {
  navigator.vibrate = (pattern) => {
    let elapsed = 0;
    [].concat(pattern).forEach((ms, i) => {
      if (i % 2 === 0 && ms > 0) {
        setTimeout(() => Haptics.vibrate({ duration: ms }).catch(() => {}), elapsed);
      }
      elapsed += ms;
    });
    return true;
  };
}

export function initNative() {
  if (!isNative) return;
  // DrivingMode prefers window.SpeechRecognition; newer WebViews define it but always report 'not-allowed'.
  window.SpeechRecognition = NativeSpeechRecognition;
  window.webkitSpeechRecognition = NativeSpeechRecognition;
  document.documentElement.classList.add('native');
  polyfillVibrate();
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#020617' }).catch(() => {});
}

// Google blocks OAuth popups inside embedded WebViews, so sign in natively and
// hand the ID token to the Firebase JS SDK; onAuthStateChanged and Firestore stay unchanged.
export async function signInWithGoogleNative(auth) {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const credential = GoogleAuthProvider.credential(result.credential?.idToken);
  return signInWithCredential(auth, credential);
}

export function signOutNative() {
  return FirebaseAuthentication.signOut().catch(() => {});
}

export function onHardwareBack(handler) {
  const handle = CapApp.addListener('backButton', handler);
  return () => { handle.then((h) => h.remove()); };
}

export function exitApp() {
  return CapApp.exitApp();
}
