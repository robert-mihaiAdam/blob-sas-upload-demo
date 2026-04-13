using blob_sas_upload_demo.Agents;
using blob_sas_upload_demo.Services;
using DotNetEnv;

Env.Load();

var storageAccount = Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT") ?? string.Empty;
var storageKey     = Environment.GetEnvironmentVariable("AZURE_STORAGE_KEY") ?? string.Empty;
var containerName  = "random-container";
var tenantKey = Guid.NewGuid().ToString();
var machineKey = Guid.NewGuid().ToString();

var sasService = new BlobSasService(storageAccount, storageKey, containerName);

await using var agent = new BlobUploadAgent(sasService);

var logContent = $"""
    [INFO]  {DateTime.UtcNow:O} — Agent initialised.
    [INFO]  TenantKey : {tenantKey}
    [INFO]  MachineKey: {machineKey}
    [INFO]  Upload POC run completed successfully.
    """;

await agent.UploadLogAsync(
    tenantKey:  tenantKey,
    machineKey: machineKey,
    logContent: logContent);

Console.WriteLine("Done.");
