/**
 * InputDetectionService — isolated wave + "pew pew" detection for the intro screen.
 *
 * Vision: MediaPipe Hands wrist tracking + velocity zero-crossing wave detector.
 * Audio:  SpeechRecognition phonetic matches + Web Audio peak-pair fallback.
 *
 * Usage (vanilla):
 *   const service = new InputDetectionService({
 *     video: document.getElementById('camera-preview'),
 *     onTrigger: (type) => console.log(type), // 'wave' | 'audio'
 *     onSuccess: () => console.log('both detected'),
 *   });
 *   await service.start(mediaStream);
 *   // ...
 *   service.stop();
 *
 * Requires MediaPipe Hands scripts loaded before start() unless `hands` is injected:
 *   https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js
 *   https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js (optional)
 */
(function (global) {
  'use strict';

  const WRIST = 0;
  const PAIRING_WINDOW_MS = 3000;
  const WRIST_BUFFER_SIZE = 45;
  const WAVE_WINDOW_MS = 1500;
  const WAVE_MIN_ZERO_CROSSINGS = 2;
  const WAVE_MIN_AMPLITUDE_RATIO = 0.06;
  const WAVE_MIN_VELOCITY = 0.00012;
  const PEW_PEAK_GAP_MIN_MS = 400;
  const PEW_PEAK_GAP_MAX_MS = 800;
  const PEW_NOISE_MARGIN = 1.25;
  const PEW_PHONETIC_PATTERN = /\b(pew|pyu|pu|pure|pewpew|pew\s*pew)\b/i;

  class InputDetectionService {
    /**
     * @param {object} options
     * @param {HTMLVideoElement} options.video
     * @param {(type: 'wave'|'audio') => void} [options.onTrigger]
     * @param {() => void} [options.onSuccess]
     * @param {() => void} [options.onPairingReset] Called when 3s pairing window expires
     * @param {object} [options.hands] Pre-initialized MediaPipe Hands instance
     * @param {(file: string) => string} [options.locateFile] MediaPipe asset resolver
     */
    constructor({ video, onTrigger, onSuccess, onPairingReset, hands, locateFile } = {}) {
      if (!video) throw new Error('InputDetectionService requires a video element');

      this.video = video;
      this.onTrigger = onTrigger || (() => {});
      this.onSuccess = onSuccess || (() => {});
      this.onPairingReset = onPairingReset || (() => {});
      this._hands = hands || null;
      this._locateFile = locateFile || ((file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`);

      this._running = false;
      this._mediaStream = null;
      this._visionFrameId = null;

      this._waveDetected = false;
      this._audioDetected = false;
      this._successFired = false;
      this._pairingDeadline = 0;

      this._wristBuffer = [];
      this._waveZeroCrossings = 0;
      this._waveAmplitude = 0;

      this._audioContext = null;
      this._analyser = null;
      this._audioFrameId = null;
      this._speechRecognition = null;
      this._noiseFloor = 0.01;
      this._rollingVolume = 0;
      this._peakTimes = [];
      this._speechActive = false;
      this._lastSpeechMatch = '';

      this._debug = {
        waveZeroCrossings: 0,
        waveAmplitude: 0,
        waveAmplitudeThreshold: 0,
        rollingAverageVolume: 0,
        noiseFloor: 0,
        dynamicThreshold: 0,
        peakCount: 0,
        waveDetected: false,
        audioDetected: false,
        pairingMsRemaining: 0,
        wristSamples: 0,
        handTracked: false,
      };
    }

    /**
     * @param {MediaStream} mediaStream Combined camera + microphone stream
     */
    async start(mediaStream) {
      if (this._running) return;
      this._mediaStream = mediaStream;
      this._running = true;
      this._resetDetectionState();

      await this._initHands();
      await this._initAudio(mediaStream);
      this._initSpeechRecognition();

      this._hands.onResults((results) => this._onHandResults(results));
      if (typeof this._hands.initialize === 'function') {
        await this._hands.initialize();
      }
      this._runVisionLoop();
      this._runAudioLoop();
      this._runPairingTicker();
    }

    stop() {
      this._running = false;

      if (this._visionFrameId) cancelAnimationFrame(this._visionFrameId);
      if (this._audioFrameId) cancelAnimationFrame(this._audioFrameId);
      if (this._pairingIntervalId) clearInterval(this._pairingIntervalId);

      this._visionFrameId = null;
      this._audioFrameId = null;
      this._pairingIntervalId = null;

      if (this._speechRecognition) {
        try { this._speechRecognition.stop(); } catch (_) { /* noop */ }
        this._speechRecognition = null;
      }

      if (this._audioContext) {
        this._audioContext.close().catch(() => {});
        this._audioContext = null;
        this._analyser = null;
      }

      if (this._hands) {
        try { this._hands.close(); } catch (_) { /* noop */ }
        if (!this._injectedHands) this._hands = null;
      }
    }

    getDebugStats() {
      return { ...this._debug };
    }

    // ── MediaPipe / vision ──────────────────────────────────────────────

    async _initHands() {
      if (this._hands) {
        this._injectedHands = true;
        return;
      }

      if (typeof global.Hands !== 'function') {
        throw new Error(
          'MediaPipe Hands not found. Load hands.js before InputDetectionService.'
        );
      }

      this._hands = new global.Hands({
        locateFile: this._locateFile,
      });
      this._hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.45,
      });
      this._injectedHands = false;
    }

    _runVisionLoop() {
      const tick = async () => {
        if (!this._running) return;

        if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            await this._hands.send({ image: this.video });
          } catch (_) {
            /* frame drop */
          }
        }

        this._visionFrameId = requestAnimationFrame(tick);
      };

      this._visionFrameId = requestAnimationFrame(tick);
    }

    _onHandResults(results) {
      if (!this._running || this._waveDetected || this._successFired) return;

      const landmarks = results.multiHandLandmarks?.[0];
      this._debug.handTracked = !!landmarks?.[WRIST];
      if (!landmarks?.[WRIST]) return;

      const wrist = landmarks[WRIST];
      const videoWidth = this.video.videoWidth || this.video.clientWidth || 640;
      const xNorm = wrist.x;
      const now = performance.now();

      this._pushWristSample(xNorm, now, videoWidth);
      if (this._evaluateWave(videoWidth)) {
        this._registerTrigger('wave');
      }
    }

    _pushWristSample(xNorm, timestamp, videoWidth) {
      this._wristBuffer.push({ x: xNorm, t: timestamp });
      while (this._wristBuffer.length > WRIST_BUFFER_SIZE) {
        this._wristBuffer.shift();
      }

      const windowStart = timestamp - WAVE_WINDOW_MS;
      while (this._wristBuffer.length > 1 && this._wristBuffer[0].t < windowStart) {
        this._wristBuffer.shift();
      }

      this._debug.wristSamples = this._wristBuffer.length;
      this._debug.waveAmplitudeThreshold = videoWidth * WAVE_MIN_AMPLITUDE_RATIO;
    }

    /**
     * Velocity zero-crossing wave detector on wrist x (normalized 0–1).
     * Requires >= 3 direction reversals and sufficient amplitude in 1.2 s window.
     */
    _evaluateWave(videoWidth) {
      const buf = this._wristBuffer;
      if (buf.length < 4) return false;

      const velocities = [];
      for (let i = 1; i < buf.length; i++) {
        const dt = buf[i].t - buf[i - 1].t;
        if (dt <= 0) continue;
        velocities.push((buf[i].x - buf[i - 1].x) / dt);
      }

      if (velocities.length < 3) return false;

      const minVel = WAVE_MIN_VELOCITY;
      let zeroCrossings = 0;
      for (let i = 1; i < velocities.length; i++) {
        const prev = velocities[i - 1];
        const curr = velocities[i];
        if (Math.abs(prev) < minVel || Math.abs(curr) < minVel) continue;
        if (Math.sign(prev) !== Math.sign(curr)) zeroCrossings++;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      for (const sample of buf) {
        if (sample.x < minX) minX = sample.x;
        if (sample.x > maxX) maxX = sample.x;
      }

      const amplitudePx = (maxX - minX) * videoWidth;
      const amplitudeThreshold = videoWidth * WAVE_MIN_AMPLITUDE_RATIO;

      this._debug.waveZeroCrossings = zeroCrossings;
      this._debug.waveAmplitude = amplitudePx;
      this._debug.waveAmplitudeThreshold = amplitudeThreshold;
      this._waveZeroCrossings = zeroCrossings;
      this._waveAmplitude = amplitudePx;

      return (
        zeroCrossings >= WAVE_MIN_ZERO_CROSSINGS
        && amplitudePx >= amplitudeThreshold
      );
    }

    // ── Audio: Web Audio peak pair (Strategy B) ───────────────────────

    async _initAudio(mediaStream) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not supported');

      this._audioContext = new AudioCtx();
      const source = this._audioContext.createMediaStreamSource(mediaStream);
      this._analyser = this._audioContext.createAnalyser();
      this._analyser.fftSize = 2048;
      this._analyser.smoothingTimeConstant = 0.2;
      source.connect(this._analyser);

      if (this._audioContext.state === 'suspended') {
        await this._audioContext.resume();
      }
    }

    _runAudioLoop() {
      const data = new Float32Array(this._analyser.fftSize);

      const tick = () => {
        if (!this._running) return;

        if (this._analyser && !this._audioDetected && !this._successFired) {
          this._analyser.getFloatTimeDomainData(data);
          const rms = this._rms(data);
          this._rollingVolume = this._rollingVolume * 0.92 + rms * 0.08;
          this._updateNoiseFloor(rms);
          this._evaluatePeaks(rms);
        }

        this._syncDebugAudio();
        this._audioFrameId = requestAnimationFrame(tick);
      };

      this._audioFrameId = requestAnimationFrame(tick);
    }

    _rms(samples) {
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      return Math.sqrt(sum / samples.length);
    }

    _updateNoiseFloor(rms) {
      const ceiling = this._noiseFloor * PEW_NOISE_MARGIN;
      if (rms <= ceiling) {
        this._noiseFloor = this._noiseFloor * 0.95 + rms * 0.05;
      }
    }

    _evaluatePeaks(rms) {
      const threshold = this._noiseFloor * PEW_NOISE_MARGIN;
      const now = performance.now();
      const above = rms > threshold;

      if (above && !this._speechActive) {
        this._speechActive = true;
        this._registerPeak(now);
      } else if (!above && rms < threshold * 0.75) {
        this._speechActive = false;
      }

      this._peakTimes = this._peakTimes.filter((t) => now - t <= PEW_PEAK_GAP_MAX_MS + 200);

      if (this._peakTimes.length >= 2) {
        const gap = this._peakTimes[1] - this._peakTimes[0];
        if (gap >= PEW_PEAK_GAP_MIN_MS && gap <= PEW_PEAK_GAP_MAX_MS) {
          this._registerTrigger('audio');
          this._peakTimes = [];
        }
      }
    }

    _registerPeak(now) {
      const last = this._peakTimes[this._peakTimes.length - 1];
      if (!last || now - last > 120) {
        this._peakTimes.push(now);
      }
    }

    // ── Audio: SpeechRecognition (Strategy A) ───────────────────────────

    _initSpeechRecognition() {
      const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      if (!SR) return;

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        if (!this._running || this._audioDetected || this._successFired) return;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          if (!transcript) continue;

          this._lastSpeechMatch = transcript;
          if (this._isPhoneticPewMatch(transcript)) {
            this._registerTrigger('audio');
            return;
          }
        }
      };

      recognition.onerror = () => { /* non-fatal */ };

      recognition.onend = () => {
        if (this._running && this._speechRecognition) {
          try { recognition.start(); } catch (_) { /* noop */ }
        }
      };

      try {
        recognition.start();
        this._speechRecognition = recognition;
      } catch (_) {
        this._speechRecognition = null;
      }
    }

    _isPhoneticPewMatch(text) {
      const normalized = text.replace(/[^a-z\s]/g, '');
      if (PEW_PHONETIC_PATTERN.test(normalized)) return true;

      const tokens = normalized.split(/\s+/).filter(Boolean);
      if (tokens.length === 2 && tokens.every((t) => /^(pew|pyu|pu|pure)$/.test(t))) {
        return true;
      }

      return false;
    }

    // ── Pairing, debouncing, callbacks ────────────────────────────────

    _registerTrigger(type) {
      if (this._successFired) return;

      if (type === 'wave') {
        if (this._waveDetected) return;
        this._waveDetected = true;
      } else if (type === 'audio') {
        if (this._audioDetected) return;
        this._audioDetected = true;
      }

      if (!this._pairingDeadline) {
        this._pairingDeadline = performance.now() + PAIRING_WINDOW_MS;
      }

      this._syncDebugFlags();
      this.onTrigger(type);

      if (this._waveDetected && this._audioDetected) {
        this._fireSuccess();
      }
    }

    _runPairingTicker() {
      this._pairingIntervalId = setInterval(() => {
        if (!this._running || this._successFired) return;

        const now = performance.now();
        if (this._pairingDeadline > 0) {
          this._debug.pairingMsRemaining = Math.max(0, this._pairingDeadline - now);
          if (now > this._pairingDeadline && !(this._waveDetected && this._audioDetected)) {
            this._resetDetectionState();
          }
        } else {
          this._debug.pairingMsRemaining = 0;
        }

        this._syncDebugFlags();
      }, 100);
    }

    _fireSuccess() {
      if (this._successFired) return;
      this._successFired = true;
      this._pairingDeadline = 0;
      this.onSuccess();
    }

    _resetDetectionState() {
      const hadProgress = this._waveDetected || this._audioDetected;
      this._waveDetected = false;
      this._audioDetected = false;
      this._pairingDeadline = 0;
      this._wristBuffer = [];
      this._peakTimes = [];
      this._speechActive = false;
      this._waveZeroCrossings = 0;
      this._waveAmplitude = 0;
      this._syncDebugFlags();
      if (hadProgress) this.onPairingReset();
    }

    _syncDebugFlags() {
      this._debug.waveDetected = this._waveDetected;
      this._debug.audioDetected = this._audioDetected;
    }

    _syncDebugAudio() {
      this._debug.rollingAverageVolume = this._rollingVolume;
      this._debug.noiseFloor = this._noiseFloor;
      this._debug.dynamicThreshold = this._noiseFloor * PEW_NOISE_MARGIN;
      this._debug.peakCount = this._peakTimes.length;
      this._debug.lastSpeechMatch = this._lastSpeechMatch;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputDetectionService };
  }
  global.InputDetectionService = InputDetectionService;
})(typeof window !== 'undefined' ? window : globalThis);
