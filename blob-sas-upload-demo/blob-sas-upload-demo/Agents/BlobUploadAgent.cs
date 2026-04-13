using System.Net.Http.Headers;
using System.Text;
using blob_sas_upload_demo.Models;
using blob_sas_upload_demo.Services;

namespace blob_sas_upload_demo.Agents;

public sealed class BlobUploadAgent(BlobSasService sasService) : IAsyncDisposable
{
    private readonly BlobSasService _sasService = sasService;
    private readonly HttpClient _httpClient = new HttpClient();

    public async Task UploadLogAsync(string tenantKey, string machineKey, string logContent)
    {
        var request = new BlobUploadRequest
        {
            TenantKey  = tenantKey,
            MachineKey = machineKey,
        };

        var link = await _sasService.GenerateUploadSasUrlAsync(request);

        Console.WriteLine($"[BlobUploadAgent] Uploading to blob path.");

        using var requestMessage = new HttpRequestMessage(HttpMethod.Put, link.SasUrl);

        requestMessage.Headers.Add("x-ms-blob-type", "BlockBlob");

        requestMessage.Content = new StringContent(logContent, Encoding.UTF8);
        requestMessage.Content.Headers.ContentType = new MediaTypeHeaderValue("text/plain")
        {
            CharSet = "utf-8"
        };

        var response = await _httpClient.SendAsync(requestMessage);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"Blob upload failed — HTTP {(int)response.StatusCode}: {body}");
        }

        Console.WriteLine($"[BlobUploadAgent] Upload succeeded.");
    }

    public ValueTask DisposeAsync()
    {
        _httpClient.Dispose();
        return ValueTask.CompletedTask;
    }
}
