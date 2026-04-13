namespace blob_sas_upload_demo.Models;

public class SasUploadLink
{
    public required string SasUrl { get; init; }
    public DateTimeOffset ExpiresOn { get; init; }
}
