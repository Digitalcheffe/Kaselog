namespace KaseLog.Api.Services;

/// <summary>Builds Markdown and PDF exports for a single Kase.</summary>
public interface IKaseExportService
{
    /// <summary>
    /// Exports the Kase as a single Markdown file.
    /// Returns the filename slug and the UTF-8 encoded file bytes.
    /// Returns null if the Kase does not exist.
    /// </summary>
    Task<ExportResult?> ExportMarkdownAsync(Guid kaseId);

    /// <summary>
    /// Exports the Kase as a PDF document.
    /// Returns the filename slug and the PDF bytes.
    /// Returns null if the Kase does not exist.
    /// </summary>
    Task<ExportResult?> ExportPdfAsync(Guid kaseId);
}

/// <summary>The produced file ready to stream to the client.</summary>
public sealed record ExportResult(string FileName, string ContentType, byte[] Content);
