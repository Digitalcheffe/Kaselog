using System.Collections.Concurrent;
using KaseLog.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Xunit;

namespace KaseLog.Api.Tests.Middleware;

/// <summary>
/// Unit tests for <see cref="RequestLoggingMiddleware"/> log levels and format.
/// Each test drives the middleware with a synthetic <see cref="DefaultHttpContext"/>
/// that returns a preset status code, then asserts on captured log entries.
/// </summary>
public sealed class RequestLoggingMiddlewareTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static (CapturingLogger<RequestLoggingMiddleware> logger, RequestLoggingMiddleware mw)
        Build(int statusCode, string method = "GET", string path = "/api/test")
    {
        var logger = new CapturingLogger<RequestLoggingMiddleware>();
        var mw = new RequestLoggingMiddleware(
            next: ctx =>
            {
                ctx.Response.StatusCode = statusCode;
                return Task.CompletedTask;
            },
            logger: logger);

        return (logger, mw);
    }

    private static DefaultHttpContext MakeContext(string method = "GET", string path = "/api/test")
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method;
        ctx.Request.Path   = path;
        return ctx;
    }

    // ── Log level tests ───────────────────────────────────────────────────────

    [Fact]
    public async Task StatusCode_2xx_LoggedAtInformationLevel()
    {
        var (logger, mw) = Build(200);
        await mw.InvokeAsync(MakeContext());
        Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Information, logger.Entries[0].Level);
    }

    [Fact]
    public async Task StatusCode_4xx_LoggedAtWarningLevel()
    {
        var (logger, mw) = Build(404);
        await mw.InvokeAsync(MakeContext());
        Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, logger.Entries[0].Level);
    }

    [Fact]
    public async Task StatusCode_5xx_LoggedAtErrorLevel()
    {
        var (logger, mw) = Build(500);
        await mw.InvokeAsync(MakeContext());
        Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Error, logger.Entries[0].Level);
    }

    [Fact]
    public async Task HealthEndpoint_LoggedAtDebugLevel()
    {
        var (logger, mw) = Build(200, path: "/health");
        await mw.InvokeAsync(MakeContext(path: "/health"));
        Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Debug, logger.Entries[0].Level);
    }

    [Fact]
    public async Task EachRequest_ProducesExactlyOneLogEntry()
    {
        var (logger, mw) = Build(200);
        await mw.InvokeAsync(MakeContext());
        Assert.Single(logger.Entries);
    }

    // ── Format tests ──────────────────────────────────────────────────────────

    [Fact]
    public async Task LogMessage_Contains_HttpTag()
    {
        var (logger, mw) = Build(200);
        await mw.InvokeAsync(MakeContext());
        Assert.Contains("[HTTP]", logger.Entries[0].Message);
    }

    [Fact]
    public async Task LogMessage_4xx_Contains_ErrorTag()
    {
        var (logger, mw) = Build(400);
        await mw.InvokeAsync(MakeContext());
        Assert.Contains("[ERROR]", logger.Entries[0].Message);
    }

    [Fact]
    public async Task LogMessage_5xx_Contains_ErrorTag()
    {
        var (logger, mw) = Build(503);
        await mw.InvokeAsync(MakeContext());
        Assert.Contains("[ERROR]", logger.Entries[0].Message);
    }

    [Fact]
    public async Task LogMessage_Contains_StatusCode()
    {
        var (logger, mw) = Build(201, method: "POST");
        await mw.InvokeAsync(MakeContext("POST"));
        Assert.Contains("201", logger.Entries[0].Message);
    }

    [Fact]
    public async Task LogMessage_DeleteMethod_AbbreviatedToThreeChars()
    {
        var (logger, mw) = Build(204, method: "DELETE");
        var ctx = MakeContext("DELETE");
        await mw.InvokeAsync(ctx);
        Assert.Contains("DEL", logger.Entries[0].Message);
    }
}

// ── CapturingLogger ───────────────────────────────────────────────────────────

internal sealed record LogEntry(LogLevel Level, string Message);

internal sealed class CapturingLogger<T> : ILogger<T>
{
    private readonly ConcurrentBag<LogEntry> _entries = [];

    public IReadOnlyList<LogEntry> Entries => [.. _entries];

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        _entries.Add(new LogEntry(logLevel, formatter(state, exception)));
    }

    public bool IsEnabled(LogLevel logLevel) => true;

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
}
