#!/usr/bin/env node

/**
 * MSLX Agent Skill & MCP Stdio-to-SSE Bridge CLI
 *
 * Features:
 * 1. Stdio-to-SSE bridge: Reads JSON-RPC 2.0 requests from process.stdin,
 *    forwards to MSLX MCP endpoint via HTTP POST /mcp/message?sessionId=...,
 *    listens to SSE from /mcp/sse?token=..., and outputs JSON-RPC responses to process.stdout.
 * 2. CLI options: --url <mcp_base_url>, --token <mcp_token>, --help, --version.
 * 3. Subcommand: `mslx-agent-skill skill` prints out the entire SKILL.md.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const readline = require('readline');
const { URL } = require('url');

const PKG_PATH = path.resolve(__dirname, '..', 'package.json');
const SKILL_PATH = path.resolve(__dirname, '..', 'SKILL.md');

let pkg = { version: '1.0.0' };
try {
  pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
} catch (_) {}

function printHelp() {
  console.log(`
MSLX Agent Skill & MCP Bridge (v${pkg.version})
Official Model Context Protocol (MCP) Bridge & Agent Skill for MSLX Minecraft Management

Usage:
  mslx-agent-skill [command] [options]
  mslx-mcp [command] [options]
  npx @mslteam/mslx-agent-skill [command] [options]

Commands:
  (no command)        Run the Stdio-to-SSE MCP bridge for AI Agent integration
  skill               Print out the entire SKILL.md specification to stdout
  install <skills-dir> Install the bundled Skill into the specified skills directory
  version, --version  Print package version
  help, --help        Show this help message

Options:
  --url <url>         MSLX MCP base endpoint URL
                      (default: http://localhost:25333/api/plugin/mslx-plugin-ai-agents/mcp)
  --token <token>     MSLX MCP authentication token
  --debug             Enable verbose debug logging to stderr

Environment Variables:
  MSLX_MCP_URL        MCP base endpoint URL
  MSLX_MCP_TOKEN      MCP authentication token

Supported Clients:
  Google Antigravity, Cursor, Workbuddy, Qoder, Claude Desktop, Windsurf, Doubao
`);
}

function printVersion() {
  console.log(pkg.version);
}

function printSkill() {
  if (fs.existsSync(SKILL_PATH)) {
    const content = fs.readFileSync(SKILL_PATH, 'utf8');
    process.stdout.write(content);
  } else {
    process.stderr.write(`[ERROR] SKILL.md not found at ${SKILL_PATH}\n`);
    process.exit(1);
  }
}

if (process.argv[2] === 'install') {
  try {
    if (process.argv.length !== 4 || process.argv[3].startsWith('-')) {
      throw new Error('Usage: mslx-agent-skill install <skills-dir>');
    }
    const skillDirectory = path.resolve(process.argv[3], 'mslx-agent-skill');
    fs.mkdirSync(skillDirectory, { recursive: true });
    const destination = path.join(skillDirectory, 'SKILL.md');
    fs.copyFileSync(SKILL_PATH, destination, fs.constants.COPYFILE_EXCL);
    console.log(destination);
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'SKILL.md already exists in the target directory.' : error.message);
    process.exitCode = 1;
  }
  return;
}

// Parse command line arguments
const args = process.argv.slice(2);
let command = null;
let baseUrl = process.env.MSLX_MCP_URL || 'http://localhost:25333/api/plugin/mslx-plugin-ai-agents/mcp';
let token = process.env.MSLX_MCP_TOKEN || '';
let debug = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === 'help' || arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (arg === 'version' || arg === '--version' || arg === '-v') {
    printVersion();
    process.exit(0);
  } else if (arg === 'skill') {
    command = 'skill';
  } else if (arg === '--url') {
    baseUrl = args[++i] || baseUrl;
  } else if (arg.startsWith('--url=')) {
    baseUrl = arg.slice(6);
  } else if (arg === '--token') {
    token = args[++i] || token;
  } else if (arg.startsWith('--token=')) {
    token = arg.slice(8);
  } else if (arg === '--debug') {
    debug = true;
  }
}

if (command === 'skill') {
  printSkill();
  process.exit(0);
}

function logDebug(...msg) {
  if (debug) {
    process.stderr.write(`[DEBUG] ${msg.join(' ')}\n`);
  }
}

function logInfo(...msg) {
  process.stderr.write(`[INFO] ${msg.join(' ')}\n`);
}

function logError(...msg) {
  process.stderr.write(`[ERROR] ${msg.join(' ')}\n`);
}

// -------------------------------------------------------------
// Stdio-to-SSE Bridge Implementation
// -------------------------------------------------------------

let isReady = false;
let isShuttingDown = false;
let postUrl = null;
const messageQueue = [];
const emittedIds = new Set();
let sseReq = null;
let reconnectTimer = null;

function cleanupEmittedIds() {
  if (emittedIds.size > 2000) {
    const arr = Array.from(emittedIds);
    for (let i = 0; i < 1000; i++) {
      emittedIds.delete(arr[i]);
    }
  }
}

function getSseUrl() {
  const normalized = baseUrl.replace(/\/+$/, '');
  const sseObj = new URL(normalized + '/sse');
  return sseObj;
}

function connectSse() {
  if (isShuttingDown) return;

  const sseUrlObj = getSseUrl();
  logDebug(`Connecting to SSE endpoint: ${sseUrlObj.origin}${sseUrlObj.pathname}`);

  const isHttps = sseUrlObj.protocol === 'https:';
  const clientMod = isHttps ? https : http;

  const headers = {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  sseReq = clientMod.request(sseUrlObj, {
    method: 'GET',
    headers: headers
  }, (res) => {
    if (res.statusCode !== 200) {
      logError(`SSE connection failed with HTTP status ${res.statusCode}`);
      scheduleReconnect();
      return;
    }

    logDebug('SSE connection established');
    let buffer = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buffer += chunk;
      let boundaryIndex;
      while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        handleSseBlock(rawEvent, sseUrlObj);
      }
    });

    res.on('end', () => {
      logDebug('SSE connection ended by server');
      isReady = false;
      postUrl = null;
      scheduleReconnect();
    });

    res.on('error', (err) => {
      logError(`SSE stream error: ${err.message}`);
      isReady = false;
      postUrl = null;
      scheduleReconnect();
    });
  });

  sseReq.on('error', (err) => {
    logError(`SSE request connection error: ${err.message}`);
    isReady = false;
    postUrl = null;
    scheduleReconnect();
  });

  sseReq.end();
}

function handleSseBlock(block, sseUrlObj) {
  const lines = block.split(/\r?\n/);
  let eventName = 'message';
  let dataLines = [];

  for (const line of lines) {
    if (line.startsWith(':')) {
      // Comment or keepalive ping, ignore
      continue;
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const data = dataLines.join('\n');

  if (eventName === 'endpoint') {
    // Initial SSE endpoint message specifies where to send POST messages
    const endpointUri = data.trim();
    try {
      const resolved = new URL(endpointUri, sseUrlObj);
      if (resolved.origin !== sseUrlObj.origin) throw new Error('MCP endpoint changed origin');
      postUrl = resolved.toString();
      isReady = true;
      logDebug('Received MCP message endpoint');
      flushQueue();
    } catch (err) {
      logError(`Failed to resolve endpoint URL "${endpointUri}": ${err.message}`);
    }
  } else if (eventName === 'message' || (!eventName && data)) {
    // Standard JSON-RPC response or notification
    if (data && data.trim()) {
      handleIncomingJsonRpc(data.trim());
    }
  }
}

function handleIncomingJsonRpc(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.id !== undefined && parsed.id !== null) {
      if (emittedIds.has(parsed.id)) {
        return; // Avoid duplicate emission
      }
      emittedIds.add(parsed.id);
      cleanupEmittedIds();
    }
  } catch (_) {}

  // Forward JSON-RPC message directly to stdout
  process.stdout.write(jsonStr + '\n');
}

function scheduleReconnect() {
  if (isShuttingDown || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSse();
  }, 2500);
}

function flushQueue() {
  while (isReady && postUrl && messageQueue.length > 0) {
    const nextMsg = messageQueue.shift();
    sendPost(nextMsg);
  }
}

function sendPost(payload) {
  if (!postUrl) {
    messageQueue.push(payload);
    return;
  }

  try {
    const targetUrl = new URL(postUrl);
    const isHttps = targetUrl.protocol === 'https:';
    const clientMod = isHttps ? https : http;
    const body = Buffer.from(payload, 'utf8');

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = clientMod.request(targetUrl, {
      method: 'POST',
      headers: headers
    }, (res) => {
      let resData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        resData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const trimmed = resData.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.jsonrpc === '2.0') {
                handleIncomingJsonRpc(trimmed);
              }
            } catch (_) {}
          }
        } else if (res.statusCode >= 400) {
          logError(`POST returned status ${res.statusCode}: ${resData}`);
        }
      });
    });

    req.on('error', (err) => {
      logError(`Failed to send POST request: ${err.message}`);
    });

    req.write(body);
    req.end();
  } catch (err) {
    logError(`Error preparing POST request: ${err.message}`);
  }
}

// Setup stdin reader for JSON-RPC requests from Agent
const rl = readline.createInterface({
  input: process.stdin,
  output: null,
  terminal: false
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  if (isReady && postUrl) {
    sendPost(trimmed);
  } else {
    messageQueue.push(trimmed);
  }
});

rl.on('close', () => {
  shutdown();
});

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (sseReq) {
    try { sseReq.destroy(); } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start SSE connection
connectSse();
