using System.Text;
using System.Text.RegularExpressions;
using KaseLog.Api.Data;
using KaseLog.Api.Models;
using Markdig;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace KaseLog.Api.Services;

/// <summary>Builds Markdown and PDF exports for a single Log.</summary>
public sealed class LogExportService : ILogExportService
{
    private readonly ILogRepository _logs;
    private readonly IKaseRepository _kases;
    private readonly string _imagesDir;

    // Matches /api/images/UID anywhere in content (40-char uppercase alphanumeric)
    private static readonly Regex _imageApiPattern =
        new(@"/api/images/([A-Z0-9]{40})", RegexOptions.Compiled);

    public LogExportService(
        ILogRepository logs,
        IKaseRepository kases,
        ImageStorageOptions imageOptions)
    {
        _logs      = logs;
        _kases     = kases;
        _imagesDir = imageOptions.ImagesDirectory;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public async Task<ExportResult?> ExportMarkdownAsync(Guid logId)
    {
        var (log, kase) = await GatherDataAsync(logId);
        if (log is null) return null;

        var md = BuildMarkdown(log, kase);
        var bytes = Encoding.UTF8.GetBytes(md);
        var fileName = $"log-{Slug(log.Title)}.md";
        return new ExportResult(fileName, "text/markdown; charset=utf-8", bytes);
    }

    public async Task<ExportResult?> ExportPdfAsync(Guid logId)
    {
        var (log, kase) = await GatherDataAsync(logId);
        if (log is null) return null;

        var bytes = BuildPdf(log, kase);
        var fileName = $"log-{Slug(log.Title)}.pdf";
        return new ExportResult(fileName, "application/pdf", bytes);
    }

    // ── Data gathering ────────────────────────────────────────────────────────

    private async Task<(LogResponse? Log, KaseResponse? Kase)> GatherDataAsync(Guid logId)
    {
        var log = await _logs.GetByIdAsync(logId);
        if (log is null) return (null, null);

        var kase = await _kases.GetByIdAsync(log.KaseId);
        return (log, kase);
    }

    // ── Markdown builder ──────────────────────────────────────────────────────

    private string BuildMarkdown(LogResponse log, KaseResponse? kase)
    {
        var sb = new StringBuilder();

        // Title
        sb.AppendLine($"# {log.Title}");
        sb.AppendLine();

        // Metadata
        if (kase is not null)
            sb.AppendLine($"**Kase:** {kase.Title}");
        if (log.Tags.Count > 0)
            sb.AppendLine($"**Tags:** {string.Join(", ", log.Tags.Select(t => t.Name))}");
        sb.AppendLine($"**Versions:** {log.VersionCount}");
        sb.AppendLine($"**Created:** {log.CreatedAt:yyyy-MM-dd}");
        sb.AppendLine($"**Last edited:** {log.UpdatedAt:yyyy-MM-dd}");
        sb.AppendLine();

        sb.AppendLine("---");
        sb.AppendLine();

        // Content — rewrite image URLs for filesystem portability
        var content = RewriteImageUrlsForMarkdown(log.Content);
        sb.AppendLine(content);

        return sb.ToString();
    }

    // ── PDF builder ───────────────────────────────────────────────────────────

    private byte[] BuildPdf(LogResponse log, KaseResponse? kase)
    {
        var pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                page.Header().Column(col =>
                {
                    col.Item()
                        .Text(log.Title)
                        .FontSize(20).Bold().FontColor(Colors.Grey.Darken3);

                    // Kase name and metadata line
                    var metaParts = new List<string>();
                    if (kase is not null) metaParts.Add(kase.Title);
                    if (log.Tags.Count > 0)
                        metaParts.Add($"Tags: {string.Join(", ", log.Tags.Select(t => t.Name))}");
                    metaParts.Add($"v{log.VersionCount}");
                    metaParts.Add($"Created {log.CreatedAt:yyyy-MM-dd}");
                    metaParts.Add($"Edited {log.UpdatedAt:yyyy-MM-dd}");

                    col.Item().PaddingTop(4)
                        .Text(string.Join("  ·  ", metaParts))
                        .FontSize(9).FontColor(Colors.Grey.Medium);

                    col.Item().PaddingTop(8).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                });

                page.Footer().AlignCenter()
                    .Text(x =>
                    {
                        x.Span("Page ").FontSize(8).FontColor(Colors.Grey.Medium);
                        x.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Medium);
                        x.Span(" of ").FontSize(8).FontColor(Colors.Grey.Medium);
                        x.TotalPages().FontSize(8).FontColor(Colors.Grey.Medium);
                    });

                page.Content().Column(col =>
                {
                    col.Spacing(8);
                    RenderMarkdownContent(col, log.Content, pipeline);
                });
            });
        });

        return document.GeneratePdf();
    }

    // ── Markdown content renderer for PDF ─────────────────────────────────────

    private void RenderMarkdownContent(ColumnDescriptor col, string markdown, MarkdownPipeline pipeline)
    {
        var lines = markdown.Split('\n');
        var textBuffer = new StringBuilder();

        void FlushText()
        {
            var text = textBuffer.ToString().Trim();
            if (string.IsNullOrEmpty(text)) { textBuffer.Clear(); return; }

            var plain = Markdown.ToPlainText(text, pipeline).Trim();
            if (!string.IsNullOrEmpty(plain))
            {
                col.Item()
                    .Text(plain)
                    .FontSize(9).FontColor(Colors.Grey.Darken3)
                    .LineHeight(1.4f);
            }
            textBuffer.Clear();
        }

        foreach (var line in lines)
        {
            // Detect image markdown: ![alt](/api/images/UID)
            var imgMatch = Regex.Match(line, @"!\[.*?\]\(/api/images/([A-Z0-9]{40})\)");
            if (imgMatch.Success)
            {
                FlushText();
                var uid = imgMatch.Groups[1].Value;
                var imgBytes = FindImageBytes(uid);
                if (imgBytes is not null)
                {
                    col.Item().MaxWidth(400).Image(imgBytes);
                }
                continue;
            }

            // Detect HTML img tags: <img src="/api/images/UID" ...>
            var htmlImgMatch = Regex.Match(line, @"<img[^>]+src=""/api/images/([A-Z0-9]{40})""");
            if (htmlImgMatch.Success)
            {
                FlushText();
                var uid = htmlImgMatch.Groups[1].Value;
                var imgBytes = FindImageBytes(uid);
                if (imgBytes is not null)
                {
                    col.Item().MaxWidth(400).Image(imgBytes);
                }
                continue;
            }

            textBuffer.AppendLine(line);
        }

        FlushText();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private string RewriteImageUrlsForMarkdown(string content) =>
        _imageApiPattern.Replace(content, m =>
        {
            var uid = m.Groups[1].Value;
            var ext = FindImageExtension(uid);
            return ext is null ? m.Value : $"/data/images/{uid}{ext}";
        });

    private string? FindImageExtension(string uid)
    {
        if (!Directory.Exists(_imagesDir)) return null;
        var files = Directory.GetFiles(_imagesDir, $"{uid}.*");
        return files.Length > 0 ? Path.GetExtension(files[0]) : null;
    }

    private byte[]? FindImageBytes(string uid)
    {
        if (!Directory.Exists(_imagesDir)) return null;
        var files = Directory.GetFiles(_imagesDir, $"{uid}.*");
        return files.Length > 0 ? File.ReadAllBytes(files[0]) : null;
    }

    private static string Slug(string title) =>
        Regex.Replace(title.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
}
