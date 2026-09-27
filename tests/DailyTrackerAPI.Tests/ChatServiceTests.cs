using DailyTrackerAPI.DTOs;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Tests;

/// <summary>ChatService business rules against a real EF model (SQLite in-memory)</summary>
public class ChatAttachmentTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Image_is_stored_privately_and_exposed_through_member_only_url()
    {
        var msg = await _db.Service().SendAttachmentAsync(1, 1, TestFiles.Form("screen shot.png", TestFiles.Png), "", null);

        Assert.Equal("Image", msg.MessageType);
        Assert.Equal($"/api/chat/messages/{msg.Id}/attachment", msg.AttachmentUrl);
        Assert.Equal(TestFiles.Png.Length, msg.AttachmentSize);
        Assert.Equal("image/png", msg.AttachmentContentType);

        using var ctx = _db.NewContext();
        var key = ctx.ChatMessages.AsNoTracking().Single(m => m.Id == msg.Id).AttachmentUrl!;
        Assert.StartsWith("chat/1/", key);
        Assert.True(File.Exists(Path.Combine(_db.StorageRoot, "App_Data", key)), "file saved under App_Data (outside wwwroot)");
        Assert.Equal("📷 Photo", ctx.Conversations.AsNoTracking().Single(c => c.Id == 1).LastMessagePreview);
    }

    [Fact]
    public async Task Document_keeps_caption_and_reply_quote_describes_a_photo()
    {
        var photo = await _db.Service().SendAttachmentAsync(1, 1, TestFiles.Form("a.png", TestFiles.Png), null, null);
        var pdf = await _db.Service().SendAttachmentAsync(2, 1, TestFiles.Form("Q3 report.pdf", "%PDF-1.4 test"u8.ToArray()), "numbers inside", photo.Id);

        Assert.Equal("File", pdf.MessageType);
        Assert.Equal("application/pdf", pdf.AttachmentContentType);
        Assert.Equal("numbers inside", pdf.Content);
        Assert.Equal("📷 Photo", pdf.ReplyTo?.ContentPreview);
    }

    [Theory]
    [InlineData("evil.png", "<script>alert(1)</script>", "valid image")]   // fake image
    [InlineData("setup.exe", "MZ", "can't be shared")]
    [InlineData("page.html", "<b>x</b>", "can't be shared")]
    [InlineData("icon.svg", "<svg onload=alert(1)>", "can't be shared")]
    [InlineData("a.pdf", "", "empty")]
    public async Task Dangerous_or_invalid_files_are_rejected(string name, string content, string expected)
    {
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _db.Service().SendAttachmentAsync(1, 1, TestFiles.Form(name, System.Text.Encoding.UTF8.GetBytes(content)), null, null));
        Assert.Contains(expected, ex.Message);
    }

    [Fact]
    public async Task Files_over_25_MB_are_rejected()
    {
        var big = new Microsoft.AspNetCore.Http.FormFile(new MemoryStream(new byte[1]), 0, 26L * 1024 * 1024, "file", "big.zip");
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _db.Service().SendAttachmentAsync(1, 1, big, null, null));
        Assert.Contains("25 MB", ex.Message);
    }

    [Fact]
    public async Task Non_members_can_neither_upload_nor_download()
    {
        var msg = await _db.Service().SendAttachmentAsync(1, 1, TestFiles.Form("a.png", TestFiles.Png), null, null);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _db.Service().SendAttachmentAsync(3, 1, TestFiles.Form("b.pdf", "%PDF"u8.ToArray()), null, null));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _db.Service().GetAttachmentAsync(msg.Id, 3));

        var file = await _db.Service().GetAttachmentAsync(msg.Id, 2);
        Assert.True(File.Exists(file.FullPath));
        Assert.Equal("image/png", file.ContentType);
        Assert.Equal("a.png", file.FileName);
    }

    [Fact]
    public async Task Deleting_an_attachment_removes_the_file_from_disk()
    {
        var msg = await _db.Service().SendAttachmentAsync(1, 1, TestFiles.Form("a.png", TestFiles.Png), null, null);
        var path = (await _db.Service().GetAttachmentAsync(msg.Id, 1)).FullPath;

        await _db.Service().DeleteMessageAsync(msg.Id, 1);

        Assert.False(File.Exists(path));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _db.Service().GetAttachmentAsync(msg.Id, 1));
    }
}

public class ChatTextMessageTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Client_cannot_spoof_system_messages_or_attachment_links()
    {
        var msg = await _db.Service().SendMessageAsync(2, new SendMessageDto
        {
            ConversationId = 1, Content = "hi", MessageType = "System", AttachmentUrl = "javascript:alert(1)"
        });
        Assert.Equal("Text", msg.MessageType);
        Assert.Null(msg.AttachmentUrl);
    }

    [Fact]
    public async Task Empty_messages_are_rejected()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "   " }));
    }

    [Fact]
    public async Task Sent_reply_includes_its_quote_immediately()
    {
        var first = await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "question?" });
        var reply = await _db.Service().SendMessageAsync(1, new SendMessageDto { ConversationId = 1, Content = "answer", ReplyToMessageId = first.Id });
        Assert.Equal(first.Id, reply.ReplyTo?.Id);
    }

    [Fact]
    public async Task Editing_keeps_reactions_in_the_response()
    {
        var msg = await _db.Service().SendMessageAsync(2, new SendMessageDto { ConversationId = 1, Content = "hi" });
        await _db.Service().ToggleReactionAsync(msg.Id, 1, "👍");

        var edited = await _db.Service().EditMessageAsync(msg.Id, 2, "hi (edited)");

        Assert.True(edited.IsEdited);
        Assert.Single(edited.Reactions);
    }
}

public class ChatPollTests : IDisposable
{
    private readonly ChatTestDb _db = new();
    public void Dispose() => _db.Dispose();

    private Task<ChatMessageDto> Poll(int by, bool multiple = false, params string[] options) =>
        _db.Service().CreatePollAsync(by, 1, new CreatePollDto { Question = "Lunch?", Options = options.ToList(), AllowMultiple = multiple });

    [Theory]
    [InlineData("at least 2", "A", " ")]
    [InlineData("different", "Yes", "yes")]
    public async Task Invalid_polls_are_rejected(string expected, params string[] options)
    {
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => Poll(1, false, options));
        Assert.Contains(expected, ex.Message);
    }

    [Fact]
    public async Task Outsiders_cannot_create_polls()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Poll(3, false, "A", "B"));
    }

    [Fact]
    public async Task Poll_is_posted_as_a_message_and_previewed_in_the_list()
    {
        var msg = await Poll(2, false, "Pizza", "Biryani", "Salad");

        Assert.Equal("Poll", msg.MessageType);
        Assert.Equal(3, msg.Poll!.Options.Count);
        using var ctx = _db.NewContext();
        Assert.Equal("📊 Lunch?", ctx.Conversations.AsNoTracking().Single(c => c.Id == 1).LastMessagePreview);
    }

    [Fact]
    public async Task Single_choice_poll_allows_one_answer_and_moves_a_changed_vote()
    {
        var p = (await Poll(2, false, "Pizza", "Biryani")).Poll!;

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _db.Service().VotePollAsync(1, p.Id, new() { p.Options[0].Id, p.Options[1].Id }));
        Assert.Contains("only one", ex.Message);

        await _db.Service().VotePollAsync(1, p.Id, new() { p.Options[0].Id });
        var moved = (await _db.Service().VotePollAsync(1, p.Id, new() { p.Options[1].Id })).Poll!;
        Assert.Empty(moved.Options[0].VoterIds);
        Assert.Equal(new[] { 1 }, moved.Options[1].VoterIds);

        var both = (await _db.Service().VotePollAsync(2, p.Id, new() { p.Options[1].Id })).Poll!;
        Assert.Equal(2, both.TotalVoters);
    }

    [Fact]
    public async Task Multiple_choice_counts_voters_not_picks_and_empty_vote_retracts()
    {
        var p = (await Poll(1, true, "Mon", "Tue", "Wed")).Poll!;

        var voted = (await _db.Service().VotePollAsync(1, p.Id, new() { p.Options[0].Id, p.Options[2].Id })).Poll!;
        Assert.Equal(1, voted.TotalVoters);
        Assert.Equal(2, voted.Options.Count(o => o.VoterIds.Contains(1)));

        var retracted = (await _db.Service().VotePollAsync(1, p.Id, new())).Poll!;
        Assert.Equal(0, retracted.TotalVoters);
    }

    [Fact]
    public async Task Votes_must_belong_to_the_poll_and_come_from_members()
    {
        var a = (await Poll(1, false, "A", "B")).Poll!;
        var b = (await Poll(1, false, "C", "D")).Poll!;

        await Assert.ThrowsAsync<InvalidOperationException>(() => _db.Service().VotePollAsync(1, a.Id, new() { b.Options[0].Id }));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _db.Service().VotePollAsync(3, a.Id, new() { a.Options[0].Id }));
    }

    [Fact]
    public async Task Only_creator_or_group_admin_can_close_and_closed_polls_reject_votes()
    {
        var byPriya = (await Poll(2, false, "A", "B")).Poll!;   // user 1 is group admin
        var byMangesh = (await Poll(1, false, "A", "B")).Poll!;

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _db.Service().ClosePollAsync(2, byMangesh.Id));
        Assert.True((await _db.Service().ClosePollAsync(1, byPriya.Id)).Poll!.IsClosed);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _db.Service().VotePollAsync(2, byPriya.Id, new() { byPriya.Options[0].Id }));
        Assert.Contains("closed", ex.Message);
    }

    [Fact]
    public async Task Polls_cannot_be_edited_and_history_includes_results()
    {
        var msg = await Poll(1, false, "A", "B");
        await _db.Service().VotePollAsync(2, msg.Poll!.Id, new() { msg.Poll.Options[0].Id });

        await Assert.ThrowsAsync<InvalidOperationException>(() => _db.Service().EditMessageAsync(msg.Id, 1, "hacked"));

        var history = await _db.Service().GetMessagesAsync(1, 2, 50, null);
        Assert.Equal(1, history.Single(m => m.Id == msg.Id).Poll!.TotalVoters);
    }
}
