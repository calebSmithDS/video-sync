const DEFAULT_URL = 'ws://localhost:8080';

const serverUrlInput = document.getElementById('serverUrl');
const saveBtn = document.getElementById('saveBtn');
const statusMessage = document.getElementById('statusMessage');

const scriptStatus = document.getElementById('scriptStatus');
const videoStatus = document.getElementById('videoStatus');
const socketStatus = document.getElementById('socketStatus');
const reloadTabBtn = document.getElementById('reloadTabBtn');

let activeTabId = null;

// 1. Load stored URL
chrome.storage.sync.get(['serverUrl'], (res) => {
  serverUrlInput.value = res.serverUrl || DEFAULT_URL;
});

// 2. Query Tab and Check Health
function checkDiagnostics() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) {
      setDiagnosticItem(scriptStatus, 'No Tab', 'dot-err');
      return;
    }
    activeTabId = tab.id;

    // Is the user actually on Stan or YouTube?
    const isSupported = tab.url && (tab.url.includes('stan.com.au') || tab.url.includes('youtube.com'));
    if (!isSupported) {
      setDiagnosticItem(scriptStatus, 'Not on Stan', 'dot-warn');
      setDiagnosticItem(videoStatus, 'N/A', 'dot-warn');
      setDiagnosticItem(socketStatus, 'N/A', 'dot-warn');
      return;
    }

    // Ping content.js
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // CONTENT SCRIPT NOT INJECTED!
        setDiagnosticItem(scriptStatus, 'Not Injected', 'dot-err');
        setDiagnosticItem(videoStatus, 'Unknown', 'dot-warn');
        setDiagnosticItem(socketStatus, 'Unknown', 'dot-warn');
        reloadTabBtn.style.display = 'block';
      } else {
        // Injected successfully!
        reloadTabBtn.style.display = 'none';
        setDiagnosticItem(scriptStatus, 'Active', 'dot-ok');

        // Video status
        if (response.videoFound) {
          setDiagnosticItem(videoStatus, 'Hooked', 'dot-ok');
        } else {
          setDiagnosticItem(videoStatus, 'Waiting...', 'dot-warn');
        }

        // Socket status
        if (response.wsState === 'CONNECTED') {
          setDiagnosticItem(socketStatus, 'Connected', 'dot-ok');
        } else if (response.wsState === 'CONNECTING') {
          setDiagnosticItem(socketStatus, 'Connecting...', 'dot-warn');
        } else {
          setDiagnosticItem(socketStatus, 'Offline', 'dot-err');
        }
      }
    });
  });
}

function setDiagnosticItem(element, text, dotClass) {
  element.innerHTML = `<span class="dot ${dotClass}"></span>${text}`;
}

// 3. One-click reload active tab
reloadTabBtn.addEventListener('click', () => {
  if (activeTabId) {
    chrome.tabs.reload(activeTabId, () => {
      window.close(); // Close popup after requesting reload
    });
  }
});

// 4. Save & Reconnect
saveBtn.addEventListener('click', () => {
  const url = serverUrlInput.value.trim() || DEFAULT_URL;

  chrome.storage.sync.set({ serverUrl: url }, () => {
    statusMessage.textContent = 'Saved! Reconnecting...';
    statusMessage.style.color = '#4caf50';

    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { type: 'RECONNECT', serverUrl: url }, () => {
        setTimeout(checkDiagnostics, 300);
      });
    }
  });
});

// Run diagnostics immediately on popup open
checkDiagnostics();
