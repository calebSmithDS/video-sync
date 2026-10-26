require('dotenv').config();
const { WebSocketServer, WebSocket } = require('ws');
const ngrok = require('@ngrok/ngrok');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`\n==============================================`);
console.log(`🎬 [Video-Sync Server] Started locally on:`);
console.log(`   ws://localhost:${PORT}`);
console.log(`==============================================\n`);

// -------------------------------------------------------------
// 1. WebSocket Client Connection & Relay Logic
// -------------------------------------------------------------
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Connect] New client connected from ${clientIp}. Total clients: ${wss.clients.size}`);

  ws.on('message', (data, isBinary) => {
    const rawMessage = isBinary ? data : data.toString();
    console.log(`[Received] ${rawMessage}`);

    try {
      JSON.parse(rawMessage);
    } catch (err) {
      console.error('[Error] Malformed JSON received:', rawMessage);
      return;
    }

    // Broadcast to all other connected peers (avoid self-echo)
    let relayCount = 0;
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(rawMessage);
        relayCount++;
      }
    });

    console.log(`[Relayed] Sent to ${relayCount} peer(s)`);
  });

  ws.on('close', (code) => {
    console.log(`[Disconnect] Client disconnected (code: ${code}). Remaining clients: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[Socket Error]`, err.message);
  });
});

// -------------------------------------------------------------
// 2. Automated Ngrok Tunnel Startup
// -------------------------------------------------------------
async function startTunnel() {
  // If the user passed --no-tunnel, skip ngrok
  if (process.argv.includes('--no-tunnel')) {
    console.log('[Tunnel] Skipped by --no-tunnel flag.');
    return;
  }

  try {
    const listener = await ngrok.forward({
      addr: PORT,
      authtoken: process.env.NGROK_AUTHTOKEN || undefined
    });

    const httpsUrl = listener.url();
    // Convert https:// to wss:// for WebSocket clients
    const wssUrl = httpsUrl.replace(/^https:\/\//i, 'wss://');

    console.log(`\n🚀 [Ngrok Tunnel Active!]`);
    console.log(`🔗 Send this WebSocket URL for external use:`);
    console.log(`   ${wssUrl}`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.warn(`\n⚠️  [Ngrok Tunnel Notice]: Could not start Ngrok automatically.`);
    console.warn(`   Reason: ${err.message}`);
    console.warn(`   Tip: Get a free token at https://dashboard.ngrok.com and set NGROK_AUTHTOKEN, or run ngrok separately.\n`);
  }
}

startTunnel();
