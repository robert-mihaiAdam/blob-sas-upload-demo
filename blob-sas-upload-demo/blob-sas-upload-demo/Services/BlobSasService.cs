using Azure.Storage;
using Azure.Storage.Sas;
using blob_sas_upload_demo.Models;

namespace blob_sas_upload_demo.Services;

public sealed class BlobSasService(
    string storageAccountName,
    string storageAccountKey,
    string containerName,
    TimeSpan? sasValidity = null)
{
    private readonly string _containerName = containerName;
    private readonly StorageSharedKeyCredential _credential = new StorageSharedKeyCredential(storageAccountName, storageAccountKey);
    private readonly TimeSpan _sasValidity = sasValidity ?? TimeSpan.FromHours(1);

    public Task<SasUploadLink> GenerateUploadSasUrlAsync(BlobUploadRequest request)
    {
        var now       = DateTimeOffset.UtcNow;
        var blobPath  = BuildBlobPath(request.TenantKey, request.MachineKey, now);
        var startsOn  = now.AddMinutes(-5);
        var expiresOn = now.Add(_sasValidity);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = _containerName,
            BlobName          = blobPath,
            Resource          = "b",
            StartsOn          = startsOn,
            ExpiresOn         = expiresOn,
        };

        sasBuilder.SetPermissions(BlobSasPermissions.Write | BlobSasPermissions.Create);

        var sasParams = sasBuilder.ToSasQueryParameters(_credential);
        var sasUrl    = $"https://{storageAccountName}.blob.core.windows.net/{_containerName}/{blobPath}?{sasParams}";

        Console.WriteLine($"[BlobSasService] Generated SAS for '{blobPath}', expires {expiresOn:O}");

        return Task.FromResult(new SasUploadLink
        {
            SasUrl    = sasUrl,
            ExpiresOn = expiresOn,
        });
    }

    private static string BuildBlobPath(string tenantKey, string machineKey, DateTimeOffset timestamp) =>
        $"{tenantKey}/{machineKey}/{timestamp:yyyy-MM-dd}/{timestamp:HH:mm:ss}.log";
}
