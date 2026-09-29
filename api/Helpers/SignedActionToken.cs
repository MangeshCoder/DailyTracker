using System.Security.Cryptography;
using System.Text;

namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// Approve / reject links sent by email. The link carries the request id,
    /// the manager id and an expiry, signed with the server's secret key — so it
    /// can't be edited or made up (the old link was plain base64 anyone could forge).
    /// </summary>
    public static class SignedActionToken
    {
        public static string Create(string purpose, int requestId, int managerId, DateTime expiresUtc, string secret)
        {
            var payload = $"{purpose}|{requestId}|{managerId}|{expiresUtc.Ticks}";
            return $"{Base64Url(Encoding.UTF8.GetBytes(payload))}.{Base64Url(Sign(payload, secret))}";
        }

        /// <returns>false for anything malformed, tampered with, for another purpose or expired</returns>
        public static bool TryRead(string? token, string purpose, string secret,
            out int requestId, out int managerId, out bool expired)
        {
            requestId = managerId = 0; expired = false;
            try
            {
                var parts = (token ?? "").Split('.');
                if (parts.Length != 2) return false;
                var payload = Encoding.UTF8.GetString(FromBase64Url(parts[0]));
                if (!CryptographicOperations.FixedTimeEquals(FromBase64Url(parts[1]), Sign(payload, secret)))
                    return false;

                var fields = payload.Split('|');
                if (fields.Length != 4 || fields[0] != purpose) return false;
                requestId = int.Parse(fields[1]);
                managerId = int.Parse(fields[2]);
                expired = DateTime.UtcNow.Ticks > long.Parse(fields[3]);
                return true;
            }
            catch (FormatException) { return false; }
            catch (OverflowException) { return false; }
        }

        private static byte[] Sign(string payload, string secret) =>
            HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload));

        private static string Base64Url(byte[] b) =>
            Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static byte[] FromBase64Url(string s)
        {
            s = s.Replace('-', '+').Replace('_', '/');
            return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
        }
    }
}
