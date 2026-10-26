# 🎬 Stan Video Sync

A lightweight, low-latency video synchronization system for **Stan** (and YouTube) using a custom Chrome Extension (Manifest V3) and a Node.js WebSocket relay server with automated Ngrok tunneling.

---

## 🚀 Quick Start (Host Machine)

### 1. One-Time Setup
1. Open [`server/.env`](file:///c:/Users/caleb/OneDrive/Documents/video-sync/server/.env) and paste your free Ngrok auth token from [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken):
   ```env
   NGROK_AUTHTOKEN=your_token_here
   PORT=8080
   ```

2. Load the Extension into Chrome:
   - In Chrome, navigate to `chrome://extensions/`.
   - Enable **Developer mode** (top-right toggle).
   - Click **Load unpacked** (top-left) and select the `extension/` folder in this repo.
   - Pin the **Stan Video Sync** icon to your toolbar.

---

### 2. Movie Night: Starting the Session

1. **Launch the server + tunnel**:
   Open a terminal in the `server` folder and run:
   ```bash
   node index.js
   ```
   *(Or `npm start`)*

2. **Terminal Output**:
   You will see:
   ```text
   ==============================================
   🎬 [Video-Sync Server] Started locally on:
      ws://localhost:8080
   ==============================================
   🚀 [Ngrok Tunnel Active!]
   🔗 Send this WebSocket URL to your friend:
      wss://xxxx-xxxx.ngrok-free.app
   ==============================================
   ```

3. **Connect Your Browser**:
   - Your extension automatically defaults to `ws://localhost:8080`.
   - Open Stan (`https://play.stan.com.au`), start a video, and you're ready!

4. **Connect Your Friend**:
   - Send them the `wss://xxxx-xxxx.ngrok-free.app` URL.
   - They click the extension icon, paste that URL, and hit **Connect / Save**.

5. **Stop the Session**:
   - Press `Ctrl + C` in your terminal. The tunnel and server close immediately.

---

## 📦 How to Share the Extension with a Friend

Your friend does **not** need Node.js or any developer tools installed.

1. Right-click the `extension/` folder and choose **Compress to ZIP** (`stan-sync.zip`).
2. Send `stan-sync.zip` to your friend (Discord, Drive, email).
3. **Friend's 1-Minute Setup**:
   1. Unzip `stan-sync.zip`.
   2. Open Chrome $\to$ go to `chrome://extensions/`.
   3. Turn on **Developer mode** (top right).
   4. Click **Load unpacked** (top left) and select the unzipped folder.
   5. Open Stan $\to$ click the extension icon $\to$ paste your `wss://...` URL $\to$ click **Connect / Save**.

---

## 🔍 Troubleshooting & Quick Debugging

If something isn't syncing, open DevTools on Stan (`F12` $\to$ **Console**) to diagnose in seconds:

### 1. "It wasn't syncing, but clicking the video fixed it"
- **Cause**: Chrome's **Autoplay Policy**. Browsers block automated `.play()` events until the user has clicked inside the tab at least once.
- **Fix**: Both you and your friend must click anywhere on the Stan video player once after loading the page.

### 2. No `[StanSync] Hooked <video> element` in console
- **Cause**: Stan's Svelte player loads inside a **Shadow DOM**.
- **Fix**: Check that `content.js` has `findVideoDeep()`. Ensure you are on the actual playback page (`https://app.stan.com.au/programs/.../play`), not the browse catalog.

### 3. "WebSocket disconnected" or connection fails
- **If connecting locally (`ws://localhost:8080`)**: Make sure `node index.js` is running in your terminal.
- **If connecting via Ngrok (`wss://...`)**:
  - Make sure the URL begins with `wss://` (not `https://`).
  - Verify that your Ngrok terminal is still running (every restart gives a new URL).

### 4. Ghost clients / desync from previous tabs
- If you had YouTube or other Stan tabs open earlier, they might still be connected.
- **Fix**: Close older streaming tabs, press `Ctrl + C` in your server terminal, and re-run `node index.js`.

---

## 🏗️ Architecture Under the Hood

```
[User A: Stan Page] ──(DOM Event)──> [Content Script A] ──(WS Outgoing)──┐
                                                                          │
                                                                          ▼
                                                                [Node.js WS Relay Server]
                                                                (Local + Ngrok Tunnel)
                                                                          │
                                                                          ▼
[User B: Stan Page] <──(Apply DOM)── [Content Script B] <──(WS Broadcast)─┘
```

- **Loop Prevention**: Uses `isApplyingRemoteUpdate` guard flag (250ms) to silence the "echo chamber" where programmatic pause/play events trigger unwanted outbound messages.
- **Shadow DOM Penetration**: Uses recursive traversal (`findVideoDeep`) to hook Stan's encapsulated Svelte video player.
- **Selective Relay**: Server relays packets only to `client !== ws`, never bouncing a message back to the sender.
- **Drift Tolerance**: Ignores millisecond network jitter, only snapping timelines if desync exceeds `1.0s`.

