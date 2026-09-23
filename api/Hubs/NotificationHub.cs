using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using DailyTrackerAPI.Helpers;

namespace DailyTrackerAPI.Hubs
{
    // ─────────────────────────────────────────────────────────────────────────
    //  NotificationHub  –  real-time events pushed to connected clients
    //
    //  Groups strategy:
    //    user_{userId}   → personal notifications (only that user)
    //    managers        → all manager-role connections
    //    all_users       → broadcast to everyone
    //
    //  Frontend connects via:
    //    const conn = new HubConnectionBuilder()
    //      .withUrl("/hubs/notifications", { accessTokenFactory: () => token })
    //      .build();
    //    conn.on("ReceiveNotification", (payload) => { ... });
    // ─────────────────────────────────────────────────────────────────────────

    [Authorize]
    public class NotificationHub : Hub
    {
        // Called when a user connects
        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.GetUserId();
            var role = Context.User?.FindFirst("Role")?.Value;

            if (userId.HasValue)
            {
                // Add to personal group
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId.Value}");

                // Add managers to managers group
                if (role == "Manager")
                    await Groups.AddToGroupAsync(Context.ConnectionId, "managers");

                // Everyone to all_users
                await Groups.AddToGroupAsync(Context.ConnectionId, "all_users");

                // Notify team that this user is online
                await Clients.Group("all_users").SendAsync("UserOnline", new
                {
                    UserId = userId.Value,
                    ConnectedAt = DateTime.UtcNow
                });
            }

            await base.OnConnectedAsync();
        }

        // Called when a user disconnects
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.GetUserId();

            if (userId.HasValue)
            {
                await Clients.Group("all_users").SendAsync("UserOffline", new
                {
                    UserId = userId.Value,
                    DisconnectedAt = DateTime.UtcNow
                });
            }

            await base.OnDisconnectedAsync(exception);
        }

        // Client calls this to update their presence status
        public async Task UpdatePresence(string status, bool isAvailableForHelp, string? message)
        {
            var userId = Context.User?.GetUserId();
            if (!userId.HasValue) return;

            await Clients.Group("all_users").SendAsync("PresenceUpdated", new
            {
                UserId = userId.Value,
                Status = status,
                IsAvailableForHelp = isAvailableForHelp,
                Message = message
            });
        }

        // Client calls to trigger a "typing" style indicator (e.g., "adding task...")
        public async Task BroadcastActivity(string activityType)
        {
            var userId = Context.User?.GetUserId();
            if (!userId.HasValue) return;

            await Clients.Group("managers").SendAsync("UserActivity", new
            {
                UserId = userId.Value,
                Activity = activityType,
                At = DateTime.UtcNow
            });
        }
    }
}
