(function () {
  'use strict';

  const APPROVED_DELAY_MS = 1000;

  const connectScreen = document.getElementById('connect-screen');
  const previewScreen = document.getElementById('preview-screen');
  const approvedScreen = document.getElementById('approved-screen');
  const connectBtn = document.getElementById('connect-btn');
  const connectStatus = document.getElementById('connect-status');
  const video = document.getElementById('camera-preview');
  const checkWave = document.getElementById('check-wave');
  const checkPew = document.getElementById('check-pew');
  const pewFeedback = document.getElementById('pew-feedback');
  const startGameBtn = document.getElementById('start-game-btn');
  const introApp = document.getElementById('intro-app');
  const gameContainer = document.getElementById('game-container');

  let mediaStream = null;
  let inputDetector = null;
  let waveDetected = false;
  let pewDetected = false;
  let approvalPending = false;

  function isSecureContext() {
    return window.isSecureContext;
  }

  function showScreen(screen) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('is-active'));
    screen.classList.add('is-active');
  }

  function setStatus(message, isError) {
    connectStatus.textContent = message;
    connectStatus.classList.toggle('error', !!isError);
  }

  function resetChecks() {
    waveDetected = false;
    pewDetected = false;
    approvalPending = false;
    checkWave.classList.remove('done');
    checkPew.classList.remove('done');
    pewFeedback.hidden = true;
    pewFeedback.textContent = '';
  }

  function maybeApprove() {
    if (!waveDetected || !pewDetected || approvalPending) return;
    approvalPending = true;
    if (inputDetector) {
      inputDetector.stop();
      inputDetector = null;
    }

    window.setTimeout(() => {
      showScreen(approvedScreen);
      GameAudio.resumeIntroLoop();
    }, APPROVED_DELAY_MS);
  }

  function startVerification() {
    resetChecks();

    if (typeof InputDetectionService === 'undefined') {
      setStatus('Detection module failed to load. Refresh the page.', true);
      return;
    }

    if (typeof Hands === 'undefined') {
      setStatus('MediaPipe Hands failed to load. Check your network connection.', true);
      return;
    }

    inputDetector = new InputDetectionService({
      video,
      onTrigger: (type) => {
        if (type === 'wave') {
          waveDetected = true;
          checkWave.classList.add('done');
        }
        if (type === 'audio') {
          pewDetected = true;
          checkPew.classList.add('done');
          pewFeedback.hidden = true;
        }
        if (waveDetected && pewDetected) maybeApprove();
      },
      onSuccess: () => {
        waveDetected = true;
        pewDetected = true;
        checkWave.classList.add('done');
        checkPew.classList.add('done');
        maybeApprove();
      },
      onPairingReset: () => {
        waveDetected = false;
        pewDetected = false;
        checkWave.classList.remove('done');
        checkPew.classList.remove('done');
      },
    });

    inputDetector.start(mediaStream).catch((err) => {
      console.error('[Project Ark-3] InputDetectionService:', err);
      setStatus(`Verification error: ${err.message}`, true);
    });
  }

  async function connectMedia() {
    if (!isSecureContext()) {
      setStatus(
        'Camera and microphone require http://localhost or HTTPS. Run: python3 -m http.server 8080',
        true
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('This browser does not support camera access.', true);
      return;
    }

    connectBtn.disabled = true;
    setStatus('Requesting camera and microphone…', false);

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      video.srcObject = mediaStream;
      video.muted = true;
      await video.play();
      GameAudio.pauseIntroLoop();
      showScreen(previewScreen);
      startVerification();
    } catch (err) {
      connectBtn.disabled = false;
      GameAudio.startIntroLoop();
      setStatus(`Could not connect: ${err.message}. Check permissions and try again.`, true);
    }
  }

  function stopMedia() {
    if (inputDetector) {
      inputDetector.stop();
      inputDetector = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    video.srcObject = null;
  }

  function launchGame() {
    stopMedia();
    GameAudio.stopIntroLoop();
    introApp.hidden = true;
    gameContainer.hidden = false;
    document.dispatchEvent(new CustomEvent('ark3:start-game'));
  }

  connectBtn.addEventListener('click', connectMedia);
  startGameBtn.addEventListener('click', launchGame);

  if (!isSecureContext()) {
    setStatus('Open this page via http://localhost — not as a file — to use the camera.', true);
  }
})();
