using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Services.Communication;

namespace DailyTrackerAPI.Tests;

public class ChatMentionTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    private Task<ChatMessageDto> Send(int from, string text, params int[] mentions) =>
        _db.Service().SendMessageAsync(from, new SendMessageDto { ConversationId = 1, Content = text, MentionedUserIds = mentions.ToList() });

    [Fact]
    public async Task Only_other_current_members_can_be_mentioned()
    {
        // 2 = member, 1 = sender (self), 3 = outsider, 999 = unknown
        var msg = await Send(1, "@Priya please check", 2, 1, 3, 999, 2);
        Assert.Equal(new[] { 2 }, msg.MentionedUserIds);
    }

    [Fact]
    public async Task Unread_mention_flag_is_set_for_the_mentioned_user_and_cleared_on_read()
    {
        await Send(1, "@Priya review this", 2);

        var forPriya = (await _db.Service().GetMyConversationsAsync(2)).Single();
        var forMangesh = (await _db.Service().GetMyConversationsAsync(1)).Single();
        Assert.True(forPriya.HasUnreadMention);
        Assert.False(forMangesh.HasUnreadMention);

        await _db.Service().MarkConversationReadAsync(1, 2);
        Assert.False((await _db.Service().GetMyConversationsAsync(2)).Single().HasUnreadMention);
    }

    [Fact]
    public async Task Mentions_are_returned_in_history_and_hidden_once_deleted()
    {
        var msg = await Send(1, "@Priya hi", 2);
        Assert.Equal(new[] { 2 }, (await _db.Service().GetMessagesAsync(1, 2, 50, null)).Single(m => m.Id == msg.Id).MentionedUserIds);

        await _db.Service().DeleteMessageAsync(msg.Id, 1);
        Assert.Empty((await _db.Service().GetMessagesAsync(1, 2, 50, null)).Single(m => m.Id == msg.Id).MentionedUserIds);
        Assert.False((await _db.Service().GetMyConversationsAsync(2)).Single().HasUnreadMention);
    }
}

public class ChatPinTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    private Task<ChatMessageDto> Send(int from, string text) =>
        _db.Service().SendMessageAsync(from, new SendMessageDto { ConversationId = 1, Content = text });

    [Fact]
    public async Task Any_member_can_pin_and_unpin_and_the_list_is_newest_first()
    {
        var a = await Send(1, "first");
        var b = await Send(2, "second");

        var pinnedA = await _db.Service().SetPinnedAsync(a.Id, 2, true);   // Priya pins Mangesh's message
        Assert.True(pinnedA.IsPinned);
        Assert.Equal(2, pinnedA.PinnedByUserId);
        await Task.Delay(20);
        await _db.Service().SetPinnedAsync(b.Id, 1, true);

        var list = await _db.Service().GetPinnedMessagesAsync(1, 2);
        Assert.Equal(new[] { b.Id, a.Id }, list.Select(m => m.Id));

        var unpinned = await _db.Service().SetPinnedAsync(a.Id, 1, false);
        Assert.False(unpinned.IsPinned);
        Assert.Null(unpinned.PinnedByUserId);
        Assert.Single(await _db.Service().GetPinnedMessagesAsync(1, 1));
    }

    [Fact]
    public async Task Outsiders_cannot_pin_or_list_pins()
    {
        var a = await Send(1, "x");
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _db.Service().SetPinnedAsync(a.Id, 3, true));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _db.Service().GetPinnedMessagesAsync(1, 3));
    }

    [Fact]
    public async Task At_most_ten_pins_per_chat()
    {
        for (var i = 0; i < ChatService.MaxPinned; i++)
            await _db.Service().SetPinnedAsync((await Send(1, $"m{i}")).Id, 1, true);

        var extra = await Send(1, "one too many");
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _db.Service().SetPinnedAsync(extra.Id, 1, true));
        Assert.Contains("at most 10", ex.Message);
    }

    [Fact]
    public async Task Deleting_a_pinned_message_unpins_it()
    {
        var a = await Send(1, "secret");
        await _db.Service().SetPinnedAsync(a.Id, 1, true);
        await _db.Service().DeleteMessageAsync(a.Id, 1);

        Assert.Empty(await _db.Service().GetPinnedMessagesAsync(1, 1));
        await Assert.ThrowsAsync<InvalidOperationException>(() => _db.Service().SetPinnedAsync(a.Id, 1, true));
    }
}

public class ChatSearchTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Search_finds_text_and_file_names_but_not_deleted_messages_and_only_for_members()
    {
        var s = _db.Service();
        await s.SendMessageAsync(1, new SendMessageDto { ConversationId = 1, Content = "deploy the release build" });
        var gone = await s.SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "old release notes" });
        await s.DeleteMessageAsync(gone.Id, 2);
        await _db.Service().SendAttachmentAsync(2, 1, TestFiles.Form("release-checklist.pdf", "%PDF-1.4"u8.ToArray()), null, null);

        var hits = await _db.Service().SearchMessagesAsync(1, 2, "release");

        Assert.Equal(2, hits.Count);
        Assert.Contains(hits, m => m.Content == "deploy the release build");
        Assert.Contains(hits, m => m.AttachmentName == "release-checklist.pdf");
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _db.Service().SearchMessagesAsync(1, 3, "release"));
    }
}

public class ChatConversationListTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task List_has_names_unread_counts_and_newest_first()
    {
        // conversation 1 = group "Dev" (users 1, 2) from the seed; add a DM 1 ↔ 3
        var dm = await _db.Service().GetOrCreateDirectConversationAsync(1, 3);
        await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "one" });
        await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "two" });
        await Task.Delay(20);
        await _db.Service().SendMessageAsync(3, new SendMessageDto { ConversationId = dm.Id, Content = "hey" });
        await _db.Service().SendMessageAsync(1, new SendMessageDto { ConversationId = dm.Id, Content = "my own" });

        var list = await _db.Service().GetMyConversationsAsync(1);

        Assert.Equal(new[] { dm.Id, 1 }, list.Select(c => c.Id));            // newest activity first
        var direct = list[0];
        Assert.Equal("Outsider", direct.DisplayName);                        // the other person's name
        Assert.Equal(3, direct.OtherUserId);
        Assert.Equal(1, direct.UnreadCount);                                 // my own message doesn't count
        var group = list[1];
        Assert.Equal("Dev", group.DisplayName);
        Assert.Null(group.OtherUserId);
        Assert.Equal(2, group.UnreadCount);
        Assert.Equal(2, group.MemberCount);

        var counts = await _db.Service().GetAllUnreadCountsAsync(1);
        Assert.Equal(2, counts[1]);
        Assert.Equal(1, counts[dm.Id]);

        await _db.Service().MarkConversationReadAsync(1, 1);
        Assert.Equal(0, (await _db.Service().GetMyConversationsAsync(1)).Single(c => c.Id == 1).UnreadCount);
        Assert.Equal(new[] { 1, dm.Id }.OrderBy(x => x), (await _db.Service().GetMyConversationIdsAsync(1)).OrderBy(x => x));
    }

    [Fact]
    public async Task Reading_again_adds_receipts_only_for_new_messages()
    {
        await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "first" });
        await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "second" });
        await _db.Service().MarkConversationReadAsync(1, 1);
        await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "third" });
        await _db.Service().MarkConversationReadAsync(1, 1);
        await _db.Service().MarkConversationReadAsync(1, 1);   // nothing new: no duplicates

        using var db = _db.NewContext();
        var receipts = db.MessageReadReceipts.Where(r => r.UserId == 1).Select(r => r.MessageId).ToList();
        Assert.Equal(3, receipts.Count);
        Assert.Equal(3, receipts.Distinct().Count());
    }
}
