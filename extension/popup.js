const DEFAULT_URL = 'ws://localhost:8080';

const serverUrlInput = document.getElementById('serverUrl');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

// Load stored URL on popup open
chrome.storage.sync.get(['serverUrl'], (res) => {
  serverUrlInput.value = res.serverUrl || DEFAULT_URL;
});

saveBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim() || DEFAULT_URL;
  
  // Save to persistent extension storage
  chrome.storage.sync.set({ serverUrl: url }, () => {
    setStatus('Saved! Connecting...', 'status-ok');
    
    // Broadcast to the content script in the active tab to reconnect
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'RECONNECT', serverUrl: url }, (response) => {
          if (chrome.runtime.lastError) {
            // Tab is not on Stan or content script hasn't loaded yet
            setStatus('Saved (reload Stan tab if open)', 'status-ok');
          } else if (response?.status === 'ok') {
            setStatus('Connected to sync!', 'status-ok');
          }
        });
      }
    });
  });
});

function setStatus(text, className) {
  statusDiv.textContent = text;
  statusDiv.className = className;
}

