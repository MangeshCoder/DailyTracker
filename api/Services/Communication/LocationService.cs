// ─────────────────────────────────────────────────────────────────────────────
//  FILE 4:  backend/Services/LocationService.cs
//  ACTION:  CREATE new file
//
//  This is the ONLY place the Haversine formula lives.
//  All other services call this — no duplicate math anywhere.
//
//  HAVERSINE FORMULA explained simply:
//  The Earth is a sphere. Two GPS points both sit on that sphere.
//  We can't measure straight through the Earth — we need the arc distance
//  along the surface. Haversine gives us that in metres.
//  Accuracy: within 0.5% — good enough for 100m radius checks.
//
//  Configuration comes from appsettings.json → CompanyLocation section.
//  Zero hardcoded values in this file.
// ─────────────────────────────────────────────────────────────────────────────

namespace DailyTrackerAPI.Services
{
    public interface ILocationService
    {
        /// <summary>
        /// Returns distance in metres between the given coordinates
        /// and the configured company office location.
        /// </summary>
        double GetDistanceFromOffice(double latitude, double longitude);

        /// <summary>
        /// Returns true if the coordinates are within the configured
        /// radius of the company office.
        /// </summary>
        bool IsWithinOffice(double latitude, double longitude);

        /// <summary>
        /// The configured radius in metres (for use in error messages).
        /// </summary>
        double RadiusMetres { get; }

        /// <summary>
        /// The configured office name (for use in error messages).
        /// </summary>
        string OfficeName { get; }
    }

    public class LocationService : ILocationService
    {
        private readonly double _officeLat;
        private readonly double _officeLng;

        public double RadiusMetres { get; }
        public string OfficeName { get; }

        public LocationService(IConfiguration config)
        {
            // Reads from appsettings.json → CompanyLocation section
            _officeLat = config.GetValue<double>("CompanyLocation:Latitude");
            _officeLng = config.GetValue<double>("CompanyLocation:Longitude");
            RadiusMetres = config.GetValue<double>("CompanyLocation:RadiusMetres", 100);
            OfficeName = config.GetValue<string>("CompanyLocation:Name") ?? "company office";
        }

        public bool IsWithinOffice(double latitude, double longitude)
            => GetDistanceFromOffice(latitude, longitude) <= RadiusMetres;

        public double GetDistanceFromOffice(double latitude, double longitude)
            => HaversineMetres(_officeLat, _officeLng, latitude, longitude);

        // ── Haversine formula ─────────────────────────────────────────────────
        //
        //  R     = Earth's radius in metres (6,371,000 m)
        //  φ1,φ2 = latitudes of point 1 and 2 in radians
        //  Δφ    = difference in latitudes
        //  Δλ    = difference in longitudes
        //
        //  a = sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)
        //  c = 2·atan2(√a, √(1−a))
        //  d = R·c   → distance in metres
        //
        private static double HaversineMetres(
            double lat1, double lon1,
            double lat2, double lon2)
        {
            const double R = 6_371_000; // Earth radius in metres

            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                  + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                  * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return R * c;
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180;
    }
}