'use strict';

/**
 * agent.js – simulates a distributed agent that:
 *  1. Requests a short-lived SAS upload URL from the backend.
 *  2. Uploads a log file directly to Azure Blob Storage using the SAS URL.
 *
 * Usage:
 *   node src/agent.js <path-to-log-file>
 *
 * Environment variables (or via .env):
 *   BACKEND_URL  – base URL of the backend service (default: http://localhost:3000)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * Requests a SAS upload URL from the backend.
 *
 * @param {string} filename - Original filename to upload
 * @returns {Promise<{ sasUrl: string, blobName: string, expiresAt: string }>}
 */
async function requestUploadUrl(filename) {
  const url = new URL('/upload-url', BACKEND_URL);
  const body = JSON.stringify({ filename });

  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(
                `Backend returned HTTP ${res.statusCode}: ${data}`
              )
            );
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from backend: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Uploads file content directly to Azure Blob Storage via the SAS URL.
 * Uses a PUT request with the `x-ms-blob-type: BlockBlob` header required
 * by the Azure Blob Storage REST API.
 *
 * @param {string} sasUrl  - Pre-signed SAS URL
 * @param {Buffer} content - File content to upload
 * @returns {Promise<void>}
 */
async function uploadToBlob(sasUrl, content) {
  const url = new URL(sasUrl);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': 'application/octet-stream',
          'Content-Length': content.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 201) {
            return reject(
              new Error(
                `Azure Blob Storage returned HTTP ${res.statusCode}: ${data}`
              )
            );
          }
          resolve();
        });
      }
    );
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

/**
 * Main entry point: reads a log file from disk, obtains a SAS URL from the
 * backend and uploads the file directly to Azure Blob Storage.
 */
async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node src/agent.js <path-to-log-file>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const filename = path.basename(resolvedPath);
  const content = fs.readFileSync(resolvedPath);

  console.log(`[agent] Requesting upload URL for "${filename}" …`);
  const { sasUrl, blobName, expiresAt } = await requestUploadUrl(filename);
  console.log(`[agent] Received SAS URL (blob: ${blobName}, expires: ${expiresAt})`);

  console.log(`[agent] Uploading ${content.length} bytes directly to Azure Blob Storage …`);
  await uploadToBlob(sasUrl, content);
  console.log(`[agent] Upload complete. Blob name: ${blobName}`);
}

// Only execute when run directly (not when required in tests)
if (require.main === module) {
  run().catch((err) => {
    console.error('[agent] Error:', err.message);
    process.exit(1);
  });
}

module.exports = { requestUploadUrl, uploadToBlob };
