const { WebSocket } = require('ws');
const { spawn } = require('child_process');

// Start the server process
const serverProcess = spawn('node', ['index.js'], { cwd: __dirname });

serverProcess.stdout.on('data', (data) => {
  const msg = data.toString();
  console.log('[Server output]:', msg.trim());
  if (msg.includes('Started on')) {
    runClientTest();
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('[Server error]:', data.toString());
});

function runClientTest() {
  const clientA = new WebSocket('ws://localhost:8080');
  const clientB = new WebSocket('ws://localhost:8080');

  let clientBReceived = false;

  clientB.on('message', (data) => {
    console.log('[Client B received]:', data.toString());
    const payload = JSON.parse(data.toString());
    if (payload.type === 'PLAY' && payload.currentTime === 42) {
      clientBReceived = true;
      console.log('SUCCESS: Relay test passed!');
      cleanup(0);
    }
  });

  clientA.on('open', () => {
    // Wait for client B to open as well
    clientB.on('open', () => {
      console.log('[Client A sending PLAY event]');
      clientA.send(JSON.stringify({ type: 'PLAY', currentTime: 42 }));
    });
  });

  setTimeout(() => {
    if (!clientBReceived) {
      console.error('FAIL: Client B did not receive message in time.');
      cleanup(1);
    }
  }, 3000);
}

function cleanup(exitCode) {
  serverProcess.kill();
  process.exit(exitCode);
}

