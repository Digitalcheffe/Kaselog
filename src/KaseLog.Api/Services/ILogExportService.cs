namespace KaseLog.Api.Services;

/// <summary>Builds Markdown and PDF exports for a single Log.</summary>
public interface ILogExportService
{
    /// <summary>
    /// Exports the Log as a single Markdown file.
    /// Returns the filename slug and the UTF-8 encoded file bytes.
    /// Returns null if the Log does not exist.
    /// </summary>
    Task<ExportResult?> ExportMarkdownAsync(Guid logId);

    /// <summary>
    /// Exports the Log as a PDF document.
    /// Returns the filename slug and the PDF bytes.
    /// Returns null if the Log does not exist.
    /// </summary>
    Task<ExportResult?> ExportPdfAsync(Guid logId);
}
