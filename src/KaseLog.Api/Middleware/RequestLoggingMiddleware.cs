using System.Diagnostics;
using Microsoft.AspNetCore.WebUtilities;

namespace KaseLog.Api.Middleware;

/// <summary>
/// Logs every HTTP request and response in the format:
/// <para><c>[HH:mm:ss] [HTTP] GET  /api/kases            200   1ms</c></para>
/// <para>
/// 4xx responses are logged at <c>Warning</c> level using the <c>[ERROR]</c> tag;
/// 5xx at <c>Error</c> level. 2xx/3xx use the <c>[HTTP]</c> tag at
/// <c>Information</c> level. Requests to <c>/health</c> are logged at
/// <c>Debug</c> level so they are silent in Production but visible when
/// the log level is lowered for debugging.
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
        var sw = Stopwatch.StartNew();

        await _next(context);

        sw.Stop();

        var method = context.Request.Method switch
        {
            "DELETE" => "DEL",
            var m    => m,
        };

        var rawPath = context.Request.Path.Value ?? "/";
        if (context.Request.QueryString.HasValue)
            rawPath += context.Request.QueryString.Value;

        var path      = rawPath.Length > 40 ? rawPath[..40] : rawPath;
        var status    = context.Response.StatusCode;
        var ms        = sw.ElapsedMilliseconds;
        var timestamp = DateTime.UtcNow.ToString("HH:mm:ss");
        var paddedMs  = ms.ToString().PadLeft(4);

        if (status >= 500)
        {
            var detail = context.Items.TryGetValue("KaseLog.ErrorDetail", out var ed)
                ? $"  {ed}"
                : $"  {ReasonPhrases.GetReasonPhrase(status)}";
            _logger.LogError(
                "[{Ts}] [ERROR] {Method,-4} {Path,-40} {Status}{Detail}",
                timestamp, method, path, status, detail);
        }
        else if (status >= 400)
        {
            var detail = context.Items.TryGetValue("KaseLog.ErrorDetail", out var ed)
                ? $"  {ed}"
                : $"  {ReasonPhrases.GetReasonPhrase(status)}";
            _logger.LogWarning(
                "[{Ts}] [ERROR] {Method,-4} {Path,-40} {Status}{Detail}",
                timestamp, method, path, status, detail);
        }
        else if (rawPath.Equals("/health", StringComparison.OrdinalIgnoreCase))
        {
            // Health-check polling is noisy at Information — suppress to Debug.
            _logger.LogDebug(
                "[{Ts}] [HTTP] {Method,-4} {Path,-40} {Status} {Ms}ms",
                timestamp, method, path, status, paddedMs);
        }
        else
        {
            _logger.LogInformation(
                "[{Ts}] [HTTP] {Method,-4} {Path,-40} {Status} {Ms}ms",
                timestamp, method, path, status, paddedMs);
        }
    }
}
