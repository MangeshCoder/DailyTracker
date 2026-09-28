using Npgsql;

namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// Accepts a PostgreSQL connection string in either form:
    ///   Host=…;Database=…;Username=…;Password=…              (Npgsql style)
    ///   postgresql://user:password@host/database?sslmode=require   (what Neon shows)
    /// </summary>
    public static class PostgresConnection
    {
        public static string? Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return value;
            var v = value.Trim();
            if (!v.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
                && !v.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
                return v;

            var uri = new Uri(v);
            var userInfo = uri.UserInfo.Split(':', 2);
            var b = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
                Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
                Username = Uri.UnescapeDataString(userInfo[0]),
                Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            };

            foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = pair.Split('=', 2);
                var key = Uri.UnescapeDataString(kv[0]).ToLowerInvariant();
                var val = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : "";
                switch (key)
                {
                    case "sslmode":
                        b.SslMode = val.ToLowerInvariant() switch
                        {
                            "disable" => SslMode.Disable,
                            "allow" => SslMode.Allow,
                            "prefer" => SslMode.Prefer,
                            "verify-ca" => SslMode.VerifyCA,
                            "verify-full" => SslMode.VerifyFull,
                            _ => SslMode.Require,
                        };
                        break;
                    case "channel_binding":
                        b.ChannelBinding = val.Equals("require", StringComparison.OrdinalIgnoreCase)
                            ? ChannelBinding.Require : ChannelBinding.Prefer;
                        break;
                    // anything else (e.g. options=…) is not needed by this app
                }
            }
            return b.ConnectionString;
        }
    }
}
