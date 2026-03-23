using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using KaseLog.Api.Data;
using KaseLog.Api.Models;
using Markdig;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace KaseLog.Api.Services;

/// <summary>Builds Markdown and PDF exports for a Kase.</summary>
public sealed class KaseExportService : IKaseExportService
{
    private readonly IKaseRepository _kases;
    private readonly ILogRepository _logs;
    private readonly ICollectionRepository _collections;
    private readonly string _imagesDir;

    // Matches /api/images/UID anywhere in content (40-char uppercase alphanumeric)
    private static readonly Regex _imageApiPattern =
        new(@"/api/images/([A-Z0-9]{40})", RegexOptions.Compiled);

    public KaseExportService(
        IKaseRepository kases,
        ILogRepository logs,
        ICollectionRepository collections,
        ImageStorageOptions imageOptions)
    {
        _kases       = kases;
        _logs        = logs;
        _collections = collections;
        _imagesDir   = imageOptions.ImagesDirectory;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public async Task<ExportResult?> ExportMarkdownAsync(Guid kaseId)
    {
        var (kase, logs, collectionGroups) = await GatherDataAsync(kaseId);
        if (kase is null) return null;

        var md = BuildMarkdown(kase, logs, collectionGroups);
        var bytes = Encoding.UTF8.GetBytes(md);
        var fileName = $"{Slug(kase.Title)}.md";
        return new ExportResult(fileName, "text/markdown; charset=utf-8", bytes);
    }

    public async Task<ExportResult?> ExportPdfAsync(Guid kaseId)
    {
        var (kase, logs, collectionGroups) = await GatherDataAsync(kaseId);
        if (kase is null) return null;

        var bytes = BuildPdf(kase, logs, collectionGroups);
        var fileName = $"{Slug(kase.Title)}.pdf";
        return new ExportResult(fileName, "application/pdf", bytes);
    }

    // ── Data gathering ────────────────────────────────────────────────────────

    private async Task<(KaseResponse? Kase, List<LogResponse> Logs, List<CollectionGroup> Groups)>
        GatherDataAsync(Guid kaseId)
    {
        var kase = await _kases.GetByIdAsync(kaseId);
        if (kase is null) return (null, [], []);

        var logs = (await _logs.GetByKaseIdAsync(kaseId))
            .OrderByDescending(l => l.UpdatedAt)
            .ToList();

        // Collect items linked to this kase across all collections.
        var allCollections = (await _collections.GetAllAsync()).ToList();
        var groups = new List<CollectionGroup>();

        foreach (var col in allCollections)
        {
            var items = (await _collections.GetItemsAsync(
                col.Id, q: null, kaseId: kaseId,
                fieldFilters: new Dictionary<string, string>(),
                sortFieldId: null, sortAsc: false,
                page: 1, pageSize: 10_000)).ToList();

            if (items.Count == 0) continue;

            var fields = (await _collections.GetFieldsAsync(col.Id))
                .OrderBy(f => f.SortOrder)
                .ToList();

            groups.Add(new CollectionGroup(col, fields, items));
        }

        return (kase, logs, groups);
    }

    // ── Markdown builder ──────────────────────────────────────────────────────

    private string BuildMarkdown(
        KaseResponse kase,
        List<LogResponse> logs,
        List<CollectionGroup> groups)
    {
        var sb = new StringBuilder();

        // Header
        sb.AppendLine($"# {kase.Title}");
        sb.AppendLine();
        if (!string.IsNullOrWhiteSpace(kase.Description))
        {
            sb.AppendLine(kase.Description);
            sb.AppendLine();
        }
        sb.AppendLine($"*Created: {kase.CreatedAt:yyyy-MM-dd}*");
        sb.AppendLine();
        sb.AppendLine("---");
        sb.AppendLine();

        // Logs
        if (logs.Count > 0)
        {
            sb.AppendLine("## Logs");
            sb.AppendLine();

            foreach (var log in logs)
            {
                sb.AppendLine($"### {log.Title}");
                sb.AppendLine();

                var meta = new List<string>();
                if (log.Tags.Count > 0)
                    meta.Add($"**Tags:** {string.Join(", ", log.Tags.Select(t => t.Name))}");
                meta.Add($"**Versions:** {log.VersionCount}");
                meta.Add($"**Updated:** {log.UpdatedAt:yyyy-MM-dd}");

                foreach (var m in meta) sb.AppendLine(m);
                sb.AppendLine();

                // Rewrite image URLs for filesystem portability
                var content = RewriteImageUrlsForMarkdown(log.Content);
                sb.AppendLine(content);
                sb.AppendLine();
                sb.AppendLine("---");
                sb.AppendLine();
            }
        }

        // Collection items appendix
        if (groups.Count > 0)
        {
            sb.AppendLine("## Collection Items");
            sb.AppendLine();

            foreach (var group in groups)
            {
                sb.AppendLine($"### {group.Collection.Title}");
                sb.AppendLine();

                foreach (var item in group.Items)
                {
                    sb.AppendLine("| Field | Value |");
                    sb.AppendLine("|-------|-------|");

                    foreach (var field in group.Fields)
                    {
                        var raw = GetFieldValue(item.FieldValues, field.Id.ToString());
                        var display = FormatFieldValueMarkdown(field, raw);
                        sb.AppendLine($"| {Escape(field.Name)} | {Escape(display)} |");
                    }

                    sb.AppendLine();
                }
            }
        }

        return sb.ToString();
    }

    // ── PDF builder ───────────────────────────────────────────────────────────

    private byte[] BuildPdf(
        KaseResponse kase,
        List<LogResponse> logs,
        List<CollectionGroup> groups)
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
                        .Text(kase.Title)
                        .FontSize(20).Bold().FontColor(Colors.Grey.Darken3);

                    if (!string.IsNullOrWhiteSpace(kase.Description))
                    {
                        col.Item().PaddingTop(4)
                            .Text(kase.Description)
                            .FontSize(11).Italic().FontColor(Colors.Grey.Darken1);
                    }

                    col.Item().PaddingTop(4)
                        .Text($"Created {kase.CreatedAt:MMMM d, yyyy}  ·  {logs.Count} log(s)")
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
                    col.Spacing(16);

                    // ── Logs ────────────────────────────────────────────────
                    if (logs.Count > 0)
                    {
                        col.Item()
                            .Text("Logs")
                            .FontSize(14).Bold().FontColor(Colors.Grey.Darken2);

                        foreach (var log in logs)
                        {
                            col.Item().Column(logCol =>
                            {
                                logCol.Spacing(4);

                                // Title row
                                logCol.Item().Row(row =>
                                {
                                    row.RelativeItem()
                                        .Text(log.Title)
                                        .FontSize(12).Bold();

                                    row.AutoItem().AlignRight()
                                        .Text($"v{log.VersionCount}  ·  {log.UpdatedAt:yyyy-MM-dd}")
                                        .FontSize(8).FontColor(Colors.Grey.Medium);
                                });

                                // Tags
                                if (log.Tags.Count > 0)
                                {
                                    logCol.Item()
                                        .Text($"Tags: {string.Join(", ", log.Tags.Select(t => t.Name))}")
                                        .FontSize(8).Italic().FontColor(Colors.Grey.Darken1);
                                }

                                logCol.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);

                                // Content: render markdown as plain text with inline images
                                RenderMarkdownContent(logCol, log.Content, pipeline);
                            });

                            col.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
                        }
                    }

                    // ── Collection items appendix ────────────────────────
                    if (groups.Count > 0)
                    {
                        col.Item()
                            .Text("Collection Items")
                            .FontSize(14).Bold().FontColor(Colors.Grey.Darken2);

                        foreach (var group in groups)
                        {
                            col.Item().Column(grpCol =>
                            {
                                grpCol.Spacing(6);

                                grpCol.Item()
                                    .Text(group.Collection.Title)
                                    .FontSize(12).Bold();

                                foreach (var item in group.Items)
                                {
                                    grpCol.Item().Table(table =>
                                    {
                                        table.ColumnsDefinition(c =>
                                        {
                                            c.RelativeColumn(1);
                                            c.RelativeColumn(2);
                                        });

                                        foreach (var field in group.Fields)
                                        {
                                            var raw = GetFieldValue(item.FieldValues, field.Id.ToString());
                                            var display = FormatFieldValuePdf(field, raw);

                                            table.Cell().Background(Colors.Grey.Lighten3)
                                                .Padding(4)
                                                .Text(field.Name).FontSize(9).Bold();

                                            table.Cell().Padding(4)
                                                .Text(display).FontSize(9);
                                        }
                                    });

                                    if (group.Items.Count > 1)
                                        grpCol.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                                }
                            });
                        }
                    }
                });
            });
        });

        return document.GeneratePdf();
    }

    // ── Markdown content renderer for PDF ─────────────────────────────────────

    private void RenderMarkdownContent(ColumnDescriptor col, string markdown, MarkdownPipeline pipeline)
    {
        // Split markdown into blocks; render images inline, text as plain paragraphs.
        var lines = markdown.Split('\n');
        var textBuffer = new StringBuilder();

        void FlushText()
        {
            var text = textBuffer.ToString().Trim();
            if (string.IsNullOrEmpty(text)) { textBuffer.Clear(); return; }

            // Strip markdown to plain readable text via Markdig's plain-text renderer
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

            // Also detect HTML img tags: <img src="/api/images/UID" ...>
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

    /// <summary>Rewrites /api/images/UID to /data/images/UID.ext in markdown content.</summary>
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

    private static string GetFieldValue(JsonElement fieldValues, string fieldId)
    {
        if (fieldValues.ValueKind == JsonValueKind.Object &&
            fieldValues.TryGetProperty(fieldId, out var val))
        {
            return val.ValueKind switch
            {
                JsonValueKind.String => val.GetString() ?? string.Empty,
                JsonValueKind.Number => val.GetRawText(),
                JsonValueKind.True   => "Yes",
                JsonValueKind.False  => "No",
                JsonValueKind.Null   => string.Empty,
                _                   => val.GetRawText(),
            };
        }
        return string.Empty;
    }

    private static string FormatFieldValueMarkdown(CollectionFieldResponse field, string raw)
    {
        if (string.IsNullOrEmpty(raw)) return "—";
        return field.Type switch
        {
            "rating"  => new string('★', int.TryParse(raw, out var r) ? r : 0),
            "boolean" => raw,
            "url"     => $"[{raw}]({raw})",
            "image"   => $"/data/images/{raw}",
            _         => raw,
        };
    }

    private static string FormatFieldValuePdf(CollectionFieldResponse field, string raw)
    {
        if (string.IsNullOrEmpty(raw)) return "—";
        return field.Type switch
        {
            "rating"  => new string('★', int.TryParse(raw, out var r) ? r : 0),
            "image"   => "[image]",
            _         => raw,
        };
    }

    private static string Escape(string s) =>
        s.Replace("|", "\\|").Replace("\n", " ");

    private static string Slug(string title) =>
        Regex.Replace(title.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');

    // ── Inner types ───────────────────────────────────────────────────────────

    private sealed record CollectionGroup(
        CollectionResponse Collection,
        List<CollectionFieldResponse> Fields,
        List<CollectionItemResponse> Items);
}
