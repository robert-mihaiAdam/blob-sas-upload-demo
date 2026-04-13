namespace blob_sas_upload_demo.Models;

public class BlobUploadRequest
{
    public required string TenantKey { get; init; }
    public required string MachineKey { get; init; }
}
