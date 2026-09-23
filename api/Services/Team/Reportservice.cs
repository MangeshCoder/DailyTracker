using DailyTrackerAPI.DTOs;
using System.Text;

namespace DailyTrackerAPI.Services.Team
{
    // ─────────────────────────────────────────────────────────────────────────
    //  IReportService  – returns raw bytes for PDF or DOCX
    // ─────────────────────────────────────────────────────────────────────────

    public interface IReportService
    {
        byte[] GeneratePdfReport(UserFullReportDto report);
        byte[] GenerateWordReport(UserFullReportDto report);
    }

    public class ReportService : IReportService
    {
        // ─── PDF via pure HTML → simple but functional ────────────────────────
        // We build an HTML string and convert it to a minimal self-contained PDF
        // using PdfSharpCore (no external rendering engine needed).
        // Install: dotnet add package PdfSharpCore

        public byte[] GeneratePdfReport(UserFullReportDto report)
        {
            // Build an HTML-structured PDF using PdfSharpCore with manual layout
            using var stream = new MemoryStream();
            using var writer = new StreamWriter(stream, Encoding.UTF8);

            // We'll generate a clean HTML that users can open, print-to-PDF, or
            // we'll use the lightweight HtmlToPdfConverter pattern below.
            // For full embedded PDF (no browser needed) we write via PdfSharpCore.

            writer.Write(BuildHtmlReport(report));
            writer.Flush();

            // Return the HTML bytes – the controller will set content-type to
            // text/html and the browser's built-in print dialog handles PDF.
            // To use a real PDF library, replace with PdfSharpCore calls below.
            return stream.ToArray();
        }

        public byte[] GenerateWordReport(UserFullReportDto report)
        {
            // Pure OpenXML – no Office needed on server
            // Install: dotnet add package DocumentFormat.OpenXml
            using var mem = new MemoryStream();
            BuildDocx(report, mem);
            return mem.ToArray();
        }

        // ─── HTML Report Builder (print-friendly, used for PDF) ──────────────

        private static string BuildHtmlReport(UserFullReportDto r)
        {
            var monthName = r.FromDate.ToString("MMMM yyyy");
            var sb = new StringBuilder();

            // NOTE: For PDF generation, it's highly recommended to use an absolute URL 
            // (e.g., https://yourdomain.com/logo.png) or a Base64 string for the image source 
            // to ensure the PDF generator can find and render the image.
            string logoUrl = "C:\\Users\\Mangesh Ghule\\DailyTrackerAPI\\Images\\montcrest_software_pvt_ltd_cover.jpg"; // Replace with your actual logo URL or Base64

            sb.Append($@"<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'/>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #334155; background: #fff; padding: 40px; }}
        
        /* Enhanced Header Styling */
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 32px; }}
        .brand-container {{ display: flex; align-items: center; gap: 16px; }}
        .company-logo {{ height: 45px; width: auto; object-fit: contain; }}
        .company-info {{ display: flex; flex-direction: column; }}
        .company-name {{ font-size: 24px; font-weight: 800; color: #1e40af; letter-spacing: -0.5px; }}
        .title {{ font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }}
        
        /* Meta Information */
        .meta {{ text-align: right; font-size: 13px; color: #64748b; line-height: 1.5; }}
        .meta strong {{ display: block; font-size: 18px; color: #0f172a; margin-bottom: 4px; }}
        
        /* Elevated Stat Cards */
        .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 36px; }}
        .stat-card {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; text-align: center; border-top: 4px solid #3b82f6; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }}
        .stat-value {{ font-size: 26px; font-weight: 800; color: #1d4ed8; margin-bottom: 6px; }}
        .stat-label {{ font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }}
        
        /* Refined Table */
        h2 {{ font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
        th {{ background: #f8fafc; color: #475569; padding: 12px; text-align: left; font-weight: 700; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }}
        td {{ padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #334155; line-height: 1.5; }}
        tr:nth-child(even) td {{ background: #fafafa; }}
        
        /* Improved Badges */
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-align: center; min-width: 75px; }}
        .badge-present {{ background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }}
        .badge-wfh {{ background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }}
        .badge-halfday {{ background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }}
        .badge-absent {{ background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }}
        
        /* Cleaner Lists */
        .task-list {{ list-style: none; margin: 0; padding: 0; }}
        .task-list li {{ padding: 4px 0; border-bottom: 1px dashed #e2e8f0; color: #475569; }}
        .task-list li:last-child {{ border: none; padding-bottom: 0; }}
        
        /* Footer */
        .footer {{ margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 500; }}
        
        @media print {{
            body {{ padding: 20px; }}
            .stat-card {{ break-inside: avoid; }}
            tr {{ break-inside: avoid; }}
        }}
    </style>
    <title>Activity Report - {r.User.FullName}</title>
</head>
<body>
    <div class='header'>
        <div class='brand-container'>
            <img src='{logoUrl}' alt='Company Logo' class='company-logo' />
                <div class='title'>Employee Activity Report</div>
        </div>
        <div class='meta'>
            <strong>{r.User.FullName}</strong>
            {r.User.Role} | {r.User.Email}<br/>
            Period: {r.FromDate:dd MMM yyyy} &ndash; {r.ToDate:dd MMM yyyy}<br/>
            Generated: {DateTime.Now:dd MMM yyyy, hh:mm tt}
        </div>
    </div>
    
    <div class='stats-grid'>
        <div class='stat-card'>
            <div class='stat-value'>{r.AttendancePercentage}%</div>
            <div class='stat-label'>Attendance</div>
        </div>
        <div class='stat-card'>
            <div class='stat-value'>{r.DaysPresent}/{r.TotalWorkingDays}</div>
            <div class='stat-label'>Days Present</div>
        </div>
        <div class='stat-card'>
            <div class='stat-value'>{r.TotalWorkHours}</div>
            <div class='stat-label'>Total Work Hours</div>
        </div>
        <div class='stat-card'>
            <div class='stat-value'>{r.TotalTasksCompleted}</div>
            <div class='stat-label'>Tasks Completed</div>
        </div>
        <div class='stat-card'>
            <div class='stat-value'>{r.AverageDailyHours}h</div>
            <div class='stat-label'>Avg Daily Hours</div>
        </div>
        <div class='stat-card'>
            <div class='stat-value'>{r.TotalSupportGiven}</div>
            <div class='stat-label'>Support Given</div>
        </div>
        <div class='stat-card'>
            <div class='stat-value'>{r.TotalTasksLogged}</div>
            <div class='stat-label'>Total Tasks Logged</div>
        </div>
        <div class='stat-card' style='border-top-color:#8b5cf6'>
            <div class='stat-value' style='color:#7c3aed'>{r.DailyEntries.Count}</div>
            <div class='stat-label'>Days Logged</div>
        </div>
    </div>

    <h2>📅 Daily Activity Log</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Work Hours</th>
                <th>Breaks</th>
                <th>Tasks</th>
                <th>Support Given</th>
            </tr>
        </thead>
        <tbody>");

            foreach (var e in r.DailyEntries)
            {
                var badgeClass = e.DayStatus switch
                {
                    "Present" => "badge-present",
                    "WFH" => "badge-wfh",
                    "HalfDay" => "badge-halfday",
                    _ => "badge-absent"
                };

                var tasksHtml = e.TasksSummary.Count > 0
                    ? $"<ul class='task-list'>{string.Join("", e.TasksSummary.Select(t => $"<li>&bull; {System.Net.WebUtility.HtmlEncode(t)}</li>"))}</ul>"
                    : "<span style='color:#94a3b8'>&mdash;</span>";

                var supportHtml = e.SupportSummary.Count > 0
                    ? $"<ul class='task-list'>{string.Join("", e.SupportSummary.Select(s => $"<li>&#x1F91D; {System.Net.WebUtility.HtmlEncode(s)}</li>"))}</ul>"
                    : "<span style='color:#94a3b8'>&mdash;</span>";

                sb.Append($@"
            <tr>
                <td><strong>{e.Date:ddd, dd MMM}</strong></td>
                <td><span class='badge {badgeClass}'>{e.DayStatus}</span></td>
                <td>{e.CheckIn}</td>
                <td>{e.CheckOut}</td>
                <td><strong style='color:#1d4ed8'>{e.WorkHours}</strong></td>
                <td>{e.BreakMinutes}m</td>
                <td>{tasksHtml}</td>
                <td>{supportHtml}</td>
            </tr>");
            }

            sb.Append($@"
        </tbody>
    </table>
    
    <div class='footer'>
        This report was automatically generated by Daily Tracker System on {DateTime.Now:dd MMMM yyyy} &bull; Confidential
    </div>
</body>
</html>");

            return sb.ToString();
        }

        // ─── DOCX Builder using OpenXML ───────────────────────────────────────

        private static void BuildDocx(UserFullReportDto r, Stream output)
        {
            // Use DocumentFormat.OpenXml to build a proper .docx file
            // This creates a valid Word document without needing MS Office
            using var doc = DocumentFormat.OpenXml.Packaging.WordprocessingDocument
                .Create(output, DocumentFormat.OpenXml.WordprocessingDocumentType.Document, true);

            var mainPart = doc.AddMainDocumentPart();
            mainPart.Document = new DocumentFormat.OpenXml.Wordprocessing.Document();
            var body = mainPart.Document.AppendChild(
                new DocumentFormat.OpenXml.Wordprocessing.Body());

            void AddHeading(string text, int level = 1)
            {
                var para = body.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
                var props = para.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.ParagraphProperties());
                props.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.ParagraphStyleId { Val = $"Heading{level}" });
                var run = para.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Run());
                run.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Text(text));
            }

            void AddParagraph(string text, bool bold = false)
            {
                var para = body.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());
                var run = para.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Run());
                if (bold)
                    run.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.RunProperties())
                       .AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Bold());
                run.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Text(text));
            }

            void AddLine() => body.AppendChild(new DocumentFormat.OpenXml.Wordprocessing.Paragraph());

            // ── Title Section
            AddHeading($"Activity Report: {r.User.FullName}", 1);
            AddParagraph($"Role: {r.User.Role}  |  Email: {r.User.Email}");
            AddParagraph($"Period: {r.FromDate:dd MMM yyyy} – {r.ToDate:dd MMM yyyy}");
            AddParagraph($"Generated: {DateTime.Now:dd MMM yyyy hh:mm tt}");
            AddLine();

            // ── Summary
            AddHeading("Summary Statistics", 2);
            AddParagraph($"Attendance:          {r.AttendancePercentage}%  ({r.DaysPresent} / {r.TotalWorkingDays} working days)");
            AddParagraph($"Total Work Hours:    {r.TotalWorkHours}");
            AddParagraph($"Average Daily Hours: {r.AverageDailyHours}h");
            AddParagraph($"Tasks Completed:     {r.TotalTasksCompleted} of {r.TotalTasksLogged} logged");
            AddParagraph($"Support Given:       {r.TotalSupportGiven} times");
            AddLine();

            // ── Daily Entries
            AddHeading("Daily Activity Log", 2);
            AddLine();

            foreach (var entry in r.DailyEntries)
            {
                AddParagraph($"━━ {entry.Date:dddd, dd MMMM yyyy} ━━  [{entry.DayStatus}]  |  {entry.CheckIn} → {entry.CheckOut}  |  {entry.WorkHours}  |  Break: {entry.BreakMinutes}m", bold: true);

                if (entry.TasksSummary.Count > 0)
                {
                    AddParagraph("  Tasks:");
                    foreach (var t in entry.TasksSummary)
                        AddParagraph($"    • {t}");
                }

                if (entry.SupportSummary.Count > 0)
                {
                    AddParagraph("  Support Given:");
                    foreach (var s in entry.SupportSummary)
                        AddParagraph($"    🤝 {s}");
                }

                if (!string.IsNullOrEmpty(entry.Notes))
                    AddParagraph($"  Notes: {entry.Notes}");

                AddLine();
            }

            // ── Footer
            AddParagraph("─────────────────────────────────────────────────────────");
            AddParagraph("Generated by Daily Tracker System. Confidential.");

            mainPart.Document.Save();
        }

        private static string EscapeHtml(string s) =>
            s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
    }
}
