'use strict';

require('dotenv').config();

const express = require('express');
const { randomUUID } = require('crypto');
const { generateUploadSasUrl } = require('./sasGenerator');

const app = express();
app.use(express.json());

const {
  AZURE_STORAGE_ACCOUNT_NAME,
  AZURE_STORAGE_ACCOUNT_KEY,
  AZURE_STORAGE_CONTAINER_NAME,
  SAS_EXPIRY_MINUTES,
  PORT,
} = process.env;

/**
 * POST /upload-url
 *
 * Request body:
 *   { "filename": "agent-001-2024-01-15.log" }
 *
 * Response:
 *   {
 *     "sasUrl":    "https://<account>.blob.core.windows.net/<container>/<blobName>?<sas>",
 *     "blobName":  "<uuid>-agent-001-2024-01-15.log",
 *     "expiresAt": "2024-01-15T10:05:00.000Z"
 *   }
 */
app.post('/upload-url', (req, res) => {
  const { filename } = req.body || {};

  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    return res.status(400).json({ error: 'filename is required' });
  }

  // Sanitise: strip any path separators so the agent cannot write outside
  // the intended "directory" inside the container.
  const safeName = filename.replace(/[/\\]/g, '_');

  // Prefix with a UUID to guarantee uniqueness even if the same filename is
  // submitted multiple times concurrently.
  const blobName = `${randomUUID()}-${safeName}`;

  try {
    const result = generateUploadSasUrl({
      accountName: AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: AZURE_STORAGE_ACCOUNT_KEY,
      containerName: AZURE_STORAGE_CONTAINER_NAME,
      blobName,
      expiryMinutes: SAS_EXPIRY_MINUTES ? Number(SAS_EXPIRY_MINUTES) : 5,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Failed to generate SAS URL:', err.message);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;

if (require.main === module) {
  const port = PORT ? Number(PORT) : 3000;
  app.listen(port, () => {
    console.log(`SAS upload backend listening on port ${port}`);
  });
}
