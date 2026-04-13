'use strict';

const {
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} = require('@azure/storage-blob');

/**
 * Generates a short-lived SAS URL that grants write-only access to a single
 * blob. The token expires after {@link SAS_EXPIRY_MINUTES} minutes and only
 * carries the Create+Write permission so the agent cannot read or delete
 * existing data.
 *
 * @param {object} options
 * @param {string} options.accountName   - Azure Storage account name
 * @param {string} options.accountKey    - Azure Storage account key (base-64)
 * @param {string} options.containerName - Target container name
 * @param {string} options.blobName      - Destination blob name (unique per upload)
 * @param {number} [options.expiryMinutes=5] - Token lifetime in minutes
 * @returns {{ sasUrl: string, blobName: string, expiresAt: Date }}
 */
function generateUploadSasUrl({
  accountName,
  accountKey,
  containerName,
  blobName,
  expiryMinutes = 5,
}) {
  if (!accountName || !accountKey || !containerName || !blobName) {
    throw new Error(
      'accountName, accountKey, containerName and blobName are all required'
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey
  );

  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

  // Grant only create + write — no read, delete or list
  const permissions = BlobSASPermissions.parse('cw');

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions,
      startsOn,
      expiresOn,
    },
    sharedKeyCredential
  );

  const sasUrl =
    `https://${accountName}.blob.core.windows.net/` +
    `${containerName}/${blobName}?${sasQueryParams.toString()}`;

  return { sasUrl, blobName, expiresAt: expiresOn };
}

module.exports = { generateUploadSasUrl };
