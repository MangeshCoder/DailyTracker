using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// Every moment the API sends is marked as UTC ("…Z"), so the app can show it in
    /// India time. The database gives times back without their time zone, and before
    /// this some reached the browser without the "Z" and were shown 5½ hours early.
    /// Plain dates (midnight, e.g. a log date or a holiday) are sent as they are.
    /// </summary>
    public class UtcDateTimeConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var value = reader.GetDateTime();
            // a time sent with a zone ("…Z" / "+05:30") is kept as UTC; plain values stay as they are
            return value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value;
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        {
            if (value.Kind == DateTimeKind.Unspecified && value.TimeOfDay == TimeSpan.Zero)
            {
                writer.WriteStringValue(value.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture));   // a date
                return;
            }
            var utc = value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc);
            writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture));
        }
    }
}
