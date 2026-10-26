/**
 * Stan Video Sync - Content Script
 * Injected into *.stan.com.au
 */

console.log('[StanSync] Content script loaded on Stan');

const DEFAULT_SERVER_URL = 'ws://localhost:8080';
const SYNC_THRESHOLD_SECONDS = 1.0; // Only seek if desync is > 1s

let socket = null;
let currentVideo = null;
let isApplyingRemoteUpdate = false;
let updateTimer = null;

// -------------------------------------------------------------
// 1. Loop Prevention Helper
// -------------------------------------------------------------
function setRemoteGuard(durationMs = 200) {
  isApplyingRemoteUpdate = true;
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    isApplyingRemoteUpdate = false;
  }, durationMs);
}

// -------------------------------------------------------------
// 2. WebSocket Connection & Handling
// -------------------------------------------------------------
function connectWebSocket(url) {
  if (socket) {
    try {
      socket.close();
    } catch (_) {}
  }

  console.log(`[StanSync] Connecting to relay: ${url}`);
  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('[StanSync] WebSocket connected successfully!');
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleRemoteAction(data);
    } catch (err) {
      console.error('[StanSync] Error parsing incoming message:', err);
    }
  };

  socket.onclose = () => {
    console.warn('[StanSync] WebSocket disconnected.');
  };

  socket.onerror = (err) => {
    console.error('[StanSync] WebSocket error:', err);
  };
}

function sendAction(action) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(action));
    console.log('[StanSync] Sent action:', action);
  }
}

// -------------------------------------------------------------
// 3. Applying Actions from Remote Peer (With Guard)
// -------------------------------------------------------------
function handleRemoteAction(action) {
  if (!currentVideo) {
    console.warn('[StanSync] Action received but no <video> element active yet.');
    return;
  }

  console.log('[StanSync] Applying remote action:', action);
  setRemoteGuard(250);

  const drift = Math.abs(currentVideo.currentTime - (action.currentTime || 0));

  switch (action.type) {
    case 'PLAY':
      if (drift > SYNC_THRESHOLD_SECONDS && action.currentTime !== undefined) {
        currentVideo.currentTime = action.currentTime;
      }
      if (currentVideo.paused) {
        currentVideo.play().catch((err) => console.warn('[StanSync] Autoplay blocked:', err));
      }
      break;

    case 'PAUSE':
      if (drift > SYNC_THRESHOLD_SECONDS && action.currentTime !== undefined) {
        currentVideo.currentTime = action.currentTime;
      }
      if (!currentVideo.paused) {
        currentVideo.pause();
      }
      break;

    case 'SEEK':
      if (action.currentTime !== undefined && drift > 0.3) {
        currentVideo.currentTime = action.currentTime;
      }
      break;

    default:
      console.warn('[StanSync] Unknown action type:', action.type);
  }
}

// -------------------------------------------------------------
// 4. Hooking the DOM <video> Element
// -------------------------------------------------------------
function attachVideoListeners(video) {
  if (currentVideo === video) return; // Already attached
  currentVideo = video;
  console.log('[StanSync] Hooked <video> element:', video);

  // Play Event
  video.addEventListener('play', () => {
    if (isApplyingRemoteUpdate) return;
    sendAction({
      type: 'PLAY',
      currentTime: video.currentTime
    });
  });

  // Pause Event
  video.addEventListener('pause', () => {
    if (isApplyingRemoteUpdate) return;
    sendAction({
      type: 'PAUSE',
      currentTime: video.currentTime
    });
  });

  // Seeked Event (User scrubbed timeline)
  video.addEventListener('seeked', () => {
    if (isApplyingRemoteUpdate) return;
    sendAction({
      type: 'SEEK',
      currentTime: video.currentTime
    });
  });
}

// -------------------------------------------------------------
// 5. Player Detection (DOM + Shadow DOM + MutationObserver)
// -------------------------------------------------------------
function findVideoDeep(root = document) {
  // Direct check
  const directVideo = root.querySelector('video');
  if (directVideo) return directVideo;

  // Search inside all shadow roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const nested = findVideoDeep(el.shadowRoot);
      if (nested) return nested;
    }
  }
  return null;
}

function findAndAttachVideo() {
  const video = findVideoDeep(document);
  if (video) {
    attachVideoListeners(video);
    return true;
  }
  return false;
}

// Observer watches for player elements injected dynamically by Stan SPA
const observer = new MutationObserver(() => {
  findAndAttachVideo();
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

// Periodic fallback check in case player changes or reloads
setInterval(findAndAttachVideo, 2000);

// -------------------------------------------------------------
// 6. Bootstrap Initial Configuration & Popup Listener
// -------------------------------------------------------------
chrome.storage.sync.get(['serverUrl'], (res) => {
  const url = res.serverUrl || DEFAULT_SERVER_URL;
  connectWebSocket(url);
});

// Listen for reconnection requests from the popup UI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RECONNECT' && message.serverUrl) {
    connectWebSocket(message.serverUrl);
    sendResponse({ status: 'ok' });
  }
});

