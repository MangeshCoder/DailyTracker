using DailyTrackerAPI.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace DailyTrackerAPI.Services.Communication
{
    // ─────────────────────────────────────────────────────────────────────────
    //  INotificationSender  – use this in Services to push notifications
    // ─────────────────────────────────────────────────────────────────────────
    public interface INotificationSender
    {
        Task SendToUser(int userId, string eventName, object data);
        Task SendToManagers(string eventName, object data);
        Task SendToAll(string eventName, object data);
    }

    public class SignalRNotificationSender : INotificationSender
    {
        private readonly IHubContext<NotificationHub> _hub;

        public SignalRNotificationSender(IHubContext<NotificationHub> hub)
        {
            _hub = hub;
        }

        public Task SendToUser(int userId, string eventName, object data) =>
            _hub.Clients.Group($"user_{userId}").SendAsync(eventName, data);

        public Task SendToManagers(string eventName, object data) =>
            _hub.Clients.Group("managers").SendAsync(eventName, data);

        public Task SendToAll(string eventName, object data) =>
            _hub.Clients.Group("all_users").SendAsync(eventName, data);
    }
}
