'use strict';

const request = require('supertest');

// Stub out the sasGenerator so the server tests don't need real Azure
// credentials.
jest.mock('../src/sasGenerator', () => ({
  generateUploadSasUrl: jest.fn(({ blobName }) => ({
    sasUrl: `https://devstoreaccount1.blob.core.windows.net/logs/${blobName}?sv=2024-05-04&sig=FAKE`,
    blobName,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })),
}));

const app = require('../src/server');
const { generateUploadSasUrl } = require('../src/sasGenerator');

describe('POST /upload-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'devstoreaccount1';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = Buffer.from('key').toString('base64');
    process.env.AZURE_STORAGE_CONTAINER_NAME = 'logs';
  });

  test('returns 200 with sasUrl, blobName and expiresAt for a valid request', async () => {
    const res = await request(app)
      .post('/upload-url')
      .send({ filename: 'agent-001.log' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sasUrl');
    expect(res.body).toHaveProperty('blobName');
    expect(res.body).toHaveProperty('expiresAt');
  });

  test('blobName returned by the API is prefixed with a UUID', async () => {
    const res = await request(app)
      .post('/upload-url')
      .send({ filename: 'agent-001.log' });

    expect(res.status).toBe(200);
    // UUID prefix pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(res.body.blobName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-agent-001\.log$/
    );
  });

  test('strips path separators from the filename', async () => {
    const res = await request(app)
      .post('/upload-url')
      .send({ filename: '../../etc/passwd' });

    expect(res.status).toBe(200);
    // Path separators must be replaced with underscores
    expect(res.body.blobName).not.toContain('/');
    expect(res.body.blobName).not.toContain('\\');
  });

  test('returns 400 when filename is missing', async () => {
    const res = await request(app)
      .post('/upload-url')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when filename is empty string', async () => {
    const res = await request(app)
      .post('/upload-url')
      .send({ filename: '  ' });

    expect(res.status).toBe(400);
  });

  test('returns 500 when sasGenerator throws', async () => {
    generateUploadSasUrl.mockImplementationOnce(() => {
      throw new Error('Azure SDK error');
    });

    const res = await request(app)
      .post('/upload-url')
      .send({ filename: 'test.log' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
