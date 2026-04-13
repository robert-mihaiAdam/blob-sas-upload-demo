# blob-sas-upload-demo

Proof of concept demonstrating **secure log upload** using Azure Blob Storage
with Shared Access Signatures (SAS).

## Overview

This project implements a **direct upload pattern** where a lightweight backend
service generates short-lived, scoped SAS URLs so that agents can upload log
files directly to Azure Blob Storage—without routing file data through the
backend and without exposing storage credentials.

```
Agent ──► POST /upload-url ──► Backend (generates SAS)
                                       │
                          ◄────────────┘  { sasUrl, blobName, expiresAt }
        │
        └──► PUT <sasUrl>  ──────────────► Azure Blob Storage
```

### Security properties

| Property | Detail |
|---|---|
| Token lifetime | 5 minutes (configurable via `SAS_EXPIRY_MINUTES`) |
| Permissions | Create + Write only – no Read, Delete or List |
| Scope | Single blob per token |
| Credentials | Never leave the backend |

## Project structure

```
blob-sas-upload-demo/
├── src/
│   ├── server.js        # Express backend – POST /upload-url, GET /health
│   ├── sasGenerator.js  # Azure Blob SAS URL generation
│   └── agent.js         # Simulated agent – requests URL and uploads directly
├── tests/
│   ├── sasGenerator.test.js
│   └── server.test.js
├── .env.example
└── package.json
```

## Prerequisites

- Node.js ≥ 18
- An Azure Storage account with a container (e.g. `logs`)

## Setup

1. **Clone the repository and install dependencies**

   ```bash
   git clone https://github.com/robert-mihaiAdam/blob-sas-upload-demo.git
   cd blob-sas-upload-demo
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env and fill in AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY
   ```

## Running the backend

```bash
npm start
# → SAS upload backend listening on port 3000
```

## Running the agent

```bash
node src/agent.js /path/to/logfile.log
# [agent] Requesting upload URL for "logfile.log" …
# [agent] Received SAS URL (blob: <uuid>-logfile.log, expires: …)
# [agent] Uploading 1234 bytes directly to Azure Blob Storage …
# [agent] Upload complete. Blob name: <uuid>-logfile.log
```

## API reference

### `POST /upload-url`

Generates a time-limited SAS URL for a single blob upload.

**Request body**

```json
{ "filename": "agent-001-2024-01-15.log" }
```

**Response `200 OK`**

```json
{
  "sasUrl":    "https://<account>.blob.core.windows.net/logs/<uuid>-agent-001-2024-01-15.log?sv=…&sp=cw&…",
  "blobName":  "<uuid>-agent-001-2024-01-15.log",
  "expiresAt": "2024-01-15T10:05:00.000Z"
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | `filename` is missing or empty |
| `500` | Azure SDK / configuration error |

### `GET /health`

Returns `{ "status": "ok" }` — useful for liveness checks.

## Tests

```bash
npm test
```

Tests cover:

- SAS URL structure (correct account, container, blob name in URL)
- SAS query parameters (version, signature, expiry, permissions)
- Permissions are write-only (`cw`) – no read, delete or list
- Custom expiry window is respected
- Missing required options throw
- Backend returns correct HTTP status codes
- Filename sanitisation (path traversal prevention)

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AZURE_STORAGE_ACCOUNT_NAME` | ✅ | – | Storage account name |
| `AZURE_STORAGE_ACCOUNT_KEY` | ✅ | – | Storage account key (base-64) |
| `AZURE_STORAGE_CONTAINER_NAME` | ✅ | – | Target container name |
| `SAS_EXPIRY_MINUTES` | | `5` | Token lifetime in minutes |
| `PORT` | | `3000` | Backend HTTP port |
| `BACKEND_URL` | | `http://localhost:3000` | URL used by the agent to reach the backend |