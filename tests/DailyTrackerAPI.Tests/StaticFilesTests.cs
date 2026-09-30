using System.Net;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// The hosted site serves the built web app from wwwroot. Face-recognition model
/// files have no extension (…-shard1) and used to come back as index.html, which
/// broke face registration with "the tensor should have 2048 values but has …".
/// </summary>
public class StaticFilesTests : IDisposable
{
    private static readonly byte[] Weights = Enumerable.Range(0, 5000).Select(i => (byte)(i % 251)).ToArray();

    private readonly ApiFactory _factory = new(prepareContentRoot: root =>
    {
        Directory.CreateDirectory(Path.Combine(root, "wwwroot", "models"));
        File.WriteAllText(Path.Combine(root, "wwwroot", "index.html"), "<!doctype html><title>app</title>");
        File.WriteAllBytes(Path.Combine(root, "wwwroot", "models", "face_recognition_model-shard1"), Weights);
    });

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Face_model_files_are_served_exactly_not_as_the_web_page()
    {
        var r = await _factory.CreateClient().GetAsync("/models/face_recognition_model-shard1");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("application/octet-stream", r.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Weights, await r.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task A_missing_model_file_is_not_found_instead_of_the_web_page()
    {
        var client = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/models/missing-shard9")).StatusCode);
        Assert.Contains("<title>app</title>", await client.GetStringAsync("/dashboard"));   // app pages still work
    }
}
