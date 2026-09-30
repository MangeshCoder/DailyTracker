using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;

namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// A small Excel (.xlsx) writer — no extra package. Each sheet has a bold,
    /// frozen header row with filters; numbers stay numbers and dates stay dates,
    /// so the file can be sorted, filtered and summed in Excel / Google Sheets.
    /// </summary>
    public class XlsxWriter
    {
        public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        private readonly List<(string Name, string[] Headers, List<object?[]> Rows)> _sheets = new();

        public XlsxWriter AddSheet(string name, string[] headers, IEnumerable<object?[]> rows)
        {
            var clean = new string(name.Where(c => !"[]:*?/\\".Contains(c)).ToArray()).Trim();
            if (clean.Length == 0) clean = $"Sheet{_sheets.Count + 1}";
            _sheets.Add((clean.Length > 31 ? clean[..31] : clean, headers, rows.ToList()));
            return this;
        }

        public byte[] ToBytes()
        {
            if (_sheets.Count == 0) AddSheet("Sheet1", Array.Empty<string>(), Array.Empty<object?[]>());
            using var ms = new MemoryStream();
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
            {
                Add(zip, "[Content_Types].xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                    "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                    "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
                    string.Concat(_sheets.Select((_, i) =>
                        $"<Override PartName=\"/xl/worksheets/sheet{i + 1}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>")) +
                    "</Types>");
                Add(zip, "_rels/.rels",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                    "</Relationships>");
                Add(zip, "xl/workbook.xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>" +
                    string.Concat(_sheets.Select((s, i) => $"<sheet name=\"{Esc(s.Name)}\" sheetId=\"{i + 1}\" r:id=\"rId{i + 1}\"/>")) +
                    "</sheets>" +
                    "<definedNames>" + string.Concat(_sheets.Select((s, i) => s.Headers.Length == 0 ? "" :
                        $"<definedName name=\"_xlnm._FilterDatabase\" localSheetId=\"{i}\" hidden=\"1\">'{Esc(s.Name.Replace("'", "''"))}'!$A$1:${Col(s.Headers.Length - 1)}${s.Rows.Count + 1}</definedName>")) +
                    "</definedNames></workbook>");
                Add(zip, "xl/_rels/workbook.xml.rels",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                    string.Concat(_sheets.Select((_, i) =>
                        $"<Relationship Id=\"rId{i + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{i + 1}.xml\"/>")) +
                    $"<Relationship Id=\"rId{_sheets.Count + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
                    "</Relationships>");
                // styles: 0 normal · 1 header · 2 date · 3 date + time · 4 money · 5 decimal
                Add(zip, "xl/styles.xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                    "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                    "<numFmts count=\"3\"><numFmt numFmtId=\"164\" formatCode=\"dd-mmm-yyyy\"/><numFmt numFmtId=\"165\" formatCode=\"dd-mmm-yyyy hh:mm AM/PM\"/><numFmt numFmtId=\"166\" formatCode=\"#,##0.00\"/></numFmts>" +
                    "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><color rgb=\"FFFFFFFF\"/><name val=\"Calibri\"/></font></fonts>" +
                    "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>" +
                    "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF2563EB\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>" +
                    "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
                    "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
                    "<cellXfs count=\"6\">" +
                    "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
                    "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>" +
                    "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
                    "<xf numFmtId=\"165\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
                    "<xf numFmtId=\"166\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
                    "<xf numFmtId=\"2\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/>" +
                    "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>");
                for (var i = 0; i < _sheets.Count; i++)
                    Add(zip, $"xl/worksheets/sheet{i + 1}.xml", Sheet(_sheets[i].Headers, _sheets[i].Rows));
            }
            return ms.ToArray();
        }

        private static string Sheet(string[] headers, List<object?[]> rows)
        {
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
            if (headers.Length > 0)
                sb.Append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>");

            // column widths from the longest text in each column
            var cols = Math.Max(headers.Length, rows.Count == 0 ? 0 : rows.Max(r => r.Length));
            if (cols > 0)
            {
                sb.Append("<cols>");
                for (var c = 0; c < cols; c++)
                {
                    var longest = Math.Max(c < headers.Length ? headers[c].Length : 0,
                        rows.Count == 0 ? 0 : rows.Max(r => c < r.Length ? Shown(r[c]).Length : 0));
                    var width = Math.Clamp(longest + 3, 8, 60);
                    sb.Append($"<col min=\"{c + 1}\" max=\"{c + 1}\" width=\"{width}\" customWidth=\"1\"/>");
                }
                sb.Append("</cols>");
            }

            sb.Append("<sheetData>");
            var rowNo = 1;
            if (headers.Length > 0)
            {
                sb.Append($"<row r=\"{rowNo}\">");
                for (var c = 0; c < headers.Length; c++) sb.Append(Cell(c, rowNo, headers[c], header: true));
                sb.Append("</row>");
                rowNo++;
            }
            foreach (var row in rows)
            {
                sb.Append($"<row r=\"{rowNo}\">");
                for (var c = 0; c < row.Length; c++) sb.Append(Cell(c, rowNo, row[c]));
                sb.Append("</row>");
                rowNo++;
            }
            sb.Append("</sheetData>");
            if (headers.Length > 0)
                sb.Append($"<autoFilter ref=\"A1:{Col(headers.Length - 1)}{Math.Max(rowNo - 1, 1)}\"/>");
            sb.Append("</worksheet>");
            return sb.ToString();
        }

        private static string Cell(int col, int row, object? value, bool header = false)
        {
            var at = $"{Col(col)}{row}";
            if (header) return $"<c r=\"{at}\" s=\"1\" t=\"inlineStr\"><is><t>{Esc(value?.ToString() ?? "")}</t></is></c>";
            return value switch
            {
                null => "",
                DateTime d when d.TimeOfDay == TimeSpan.Zero => $"<c r=\"{at}\" s=\"2\"><v>{d.ToOADate().ToString(CultureInfo.InvariantCulture)}</v></c>",
                DateTime d => $"<c r=\"{at}\" s=\"3\"><v>{d.ToOADate().ToString(CultureInfo.InvariantCulture)}</v></c>",
                decimal m => $"<c r=\"{at}\" s=\"4\"><v>{m.ToString(CultureInfo.InvariantCulture)}</v></c>",
                double f => $"<c r=\"{at}\" s=\"5\"><v>{f.ToString(CultureInfo.InvariantCulture)}</v></c>",
                float f => $"<c r=\"{at}\" s=\"5\"><v>{f.ToString(CultureInfo.InvariantCulture)}</v></c>",
                int or long or short => $"<c r=\"{at}\"><v>{Convert.ToString(value, CultureInfo.InvariantCulture)}</v></c>",
                bool b => $"<c r=\"{at}\" t=\"inlineStr\"><is><t>{(b ? "Yes" : "No")}</t></is></c>",
                _ => $"<c r=\"{at}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{Esc(Safe(value.ToString() ?? ""))}</t></is></c>",
            };
        }

        /// <summary>Text that Excel would run as a formula when pasted elsewhere gets a leading apostrophe</summary>
        private static string Safe(string s) => s.Length > 0 && "=+-@".Contains(s[0]) && !double.TryParse(s, out _) ? "'" + s : s;

        private static string Shown(object? v) => v switch
        {
            null => "",
            DateTime d when d.TimeOfDay == TimeSpan.Zero => "00-Mmm-0000",
            DateTime => "00-Mmm-0000 00:00 AM",
            decimal m => m.ToString("#,##0.00", CultureInfo.InvariantCulture),
            _ => v.ToString() ?? "",
        };

        private static string Col(int index)
        {
            var name = "";
            for (index++; index > 0; index = (index - 1) / 26) name = (char)('A' + (index - 1) % 26) + name;
            return name;
        }

        private static string Esc(string s)
        {
            // characters not allowed in XML are dropped
            var clean = new string(s.Where(ch => ch == '\t' || ch == '\n' || ch == '\r' || ch >= ' ').ToArray());
            return SecurityElement.Escape(clean) ?? "";
        }

        private static void Add(ZipArchive zip, string path, string content)
        {
            var entry = zip.CreateEntry(path, CompressionLevel.Fastest);
            using var w = new StreamWriter(entry.Open(), new UTF8Encoding(false));
            w.Write(content);
        }
    }
}
