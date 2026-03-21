using System.Diagnostics;

namespace KaseLog.Api.Middleware;

/// <summary>
/// Logs every HTTP request and response in the format:
/// <c>[YYYY-MM-DD HH:MM:SS.fff UTC] [HTTP] METHOD /path STATUS duration_ms</c>
/// <para>
/// 4xx responses are logged at <c>Warning</c> level; 5xx at <c>Error</c> level;
/// 2xx / 3xx at <c>Information</c> level.  Requests to <c>/health</c> are
/// suppressed from Information-level logs to reduce noise.
/// </para>
/// </summary>
public sealed class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    /// <summary>Initializes a new instance of <see cref="RequestLoggingMiddleware"/>.</summary>
    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    /// <summary>Processes the request, then logs the outcome.</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        var start = DateTime.UtcNow;
        var sw    = Stopwatch.StartNew();

        await _next(context);

        sw.Stop();

        var method    = context.Request.Method;
        var path      = context.Request.Path.Value ?? "/";
        var status    = context.Response.StatusCode;
        var ms        = sw.ElapsedMilliseconds;
        var timestamp = start.ToString("yyyy-MM-dd HH:mm:ss.fff");

        var message = "[{Timestamp} UTC] [HTTP] {Method} {Path} {Status} {ElapsedMs}ms";
        var args    = new object[] { timestamp, method, path, status, ms };

        if (status >= 500)
        {
            _logger.LogError(message, args);
        }
        else if (status >= 400)
        {
            _logger.LogWarning(message, args);
        }
        else if (path.Equals("/health", StringComparison.OrdinalIgnoreCase))
        {
            // Health-check polling is noisy at Information — suppress to Debug.
            _logger.LogDebug(message, args);
        }
        else
        {
            _logger.LogInformation(message, args);
        }
    }
}
