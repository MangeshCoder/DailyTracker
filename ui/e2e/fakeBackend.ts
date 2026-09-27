// ─────────────────────────────────────────────────────────────────────────────
//  A fake DailyTracker API + live-chat hub, served inside the browser.
//
//  • REST calls to …/api/… are answered from in-memory data
//  • The SignalR hub (/hubs/chat) is a fake WebSocket; tests "receive" live
//    events with fake.push('ReceiveMessage', msg)
//  • Tests can slow down or break the history request (fake.messages.delayMs /
//    failNext / down) to reproduce network trouble
// ─────────────────────────────────────────────────────────────────────────────
import { expect, type Page, type Route, type WebSocketRoute } from '@playwright/test';

const RS = '\x1e';   // SignalR record separator

export const ME = { id: 1, fullName: 'Mangesh Ghule', email: 'mangesh@test.dev', role: 'TeamLead', isActive: true };
const NAMES: Record<number, string> = { 1: 'Mangesh Ghule', 5: 'Priya Sharma', 6: 'Rahul Verma' };

const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60_000).toISOString().replace('Z', '');

export interface FakeMessage {
  id: number; conversationId: number; senderId: number; content: string; sentAt: string;
  [key: string]: unknown;
}

export class FakeBackend {
  private nextId = 0;
  private hub: WebSocketRoute | null = null;
  private hubConnected!: () => void;
  /** Resolves once the app's live connection has completed its handshake */
  readonly hubReady = new Promise<void>(resolve => { this.hubConnected = resolve; });

  /** Conversation 10 = group "Sprint Team" (120 messages), 11 = direct chat with Rahul */
  history: Record<number, FakeMessage[]> = { 10: [], 11: [] };
  conversations = [
    { id: 10, type: 'Group', displayName: 'Sprint Team', lastMessagePreview: 'Shipped the release notes', lastMessageAt: iso(3), unreadCount: 0, hasUnreadMention: false, memberCount: 3, isMuted: false },
    { id: 11, type: 'Direct', displayName: 'Rahul Verma', otherUserId: 6, lastMessagePreview: 'Can you approve my leave?', lastMessageAt: iso(2), unreadCount: 1, hasUnreadMention: false, memberCount: 2, isMuted: false },
  ];

  /** Controls for GET /chat/conversations/{id}/messages */
  messages = {
    requests: [] as { conversationId: number; before: number | null }[],
    delayMs: 0,
    failNext: 0,        // fail this many requests, then work
    down: false,        // fail every request
  };
  sent: { conversationId: number; content: string }[] = [];
  readCalls: number[] = [];

  constructor(private page: Page) {
    for (let i = 0; i < 120; i++) this.message(10, [5, 6, 1][i % 3], `standup note ${i}`, 600 - i * 4);
    this.message(10, 1, 'Shipped the release notes', 3);
    this.message(11, 6, 'Can you approve my leave?', 2);
  }

  message(conversationId: number, senderId: number, content: string, minutesAgo = 0): FakeMessage {
    const m: FakeMessage = {
      id: ++this.nextId, conversationId, senderId, content, sentAt: iso(minutesAgo),
      senderName: NAMES[senderId], senderInitial: NAMES[senderId][0], messageType: 'Text',
      isDeleted: false, isEdited: false, reactions: [], readByUserIds: [senderId], mentionedUserIds: [], isPinned: false,
    };
    this.history[conversationId].push(m);
    return m;
  }

  /** Someone else sends a message: stored on the "server" and pushed live */
  async receive(conversationId: number, senderId: number, content: string) {
    const m = this.message(conversationId, senderId, content);
    await this.push('ReceiveMessage', m);
    return m;
  }

  /** A live hub event (waits until the app is connected, like a real server would deliver it) */
  async push(target: string, arg: unknown) {
    await this.hubReady;
    this.hub!.send(JSON.stringify({ type: 1, target, arguments: [arg] }) + RS);
  }

  async install() {
    // (one handler for all hubs: with several, the last one registered wins)
    await this.page.routeWebSocket(/\/hubs\//, ws => {
      if (ws.url().includes('/hubs/chat')) this.hub = ws;
      ws.onMessage(raw => {
        for (const part of String(raw).split(RS).filter(Boolean)) {
          const msg = JSON.parse(part);
          if (msg.protocol) {                                                       // handshake
            ws.send('{}' + RS);
            if (ws.url().includes('/hubs/chat')) this.hubConnected();
            continue;
          }
          if (msg.type === 1 && msg.invocationId)                                   // invoke → ok
            ws.send(JSON.stringify({ type: 3, invocationId: msg.invocationId, result: null }) + RS);
        }
      });
    });
    await this.page.route(/\/(api|hubs)\//, route => this.handle(route));
  }

  private async handle(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*?\/api/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let m: RegExpMatchArray | null;

    if (url.pathname.endsWith('/negotiate'))
      return json({ connectionId: 'c', connectionToken: 'c', negotiateVersion: 1, availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] });
    if (path === '/auth/login') return json({ requiresTwoFactor: false, accessToken: 'test', user: ME });
    if (path === '/chat/conversations') return json(this.conversations);
    if (path === '/chat/unread-counts') return json(Object.fromEntries(this.conversations.map(c => [c.id, c.unreadCount])));
    if (path === '/chat/users') return json([5, 6].map(id => ({ id, fullName: NAMES[id], email: '', role: 'Developer', onlineStatus: 'Online' })));

    if ((m = path.match(/^\/chat\/conversations\/(\d+)\/messages$/))) {
      const conversationId = +m[1];
      const before = url.searchParams.get('beforeMessageId');
      this.messages.requests.push({ conversationId, before: before ? +before : null });
      // snapshot now (like the server), answer later — reproduces the "slow history" race
      const size = +(url.searchParams.get('pageSize') ?? 50);
      const page = this.history[conversationId].filter(x => !before || x.id < +before).slice(-size);
      if (this.messages.delayMs) await new Promise(r => setTimeout(r, this.messages.delayMs));
      if (this.messages.down || this.messages.failNext > 0) {
        this.messages.failNext = Math.max(0, this.messages.failNext - 1);
        return route.abort('failed');
      }
      return json(page);
    }
    if ((m = path.match(/^\/chat\/conversations\/(\d+)\/read$/))) {
      this.readCalls.push(+m[1]);
      this.conversations = this.conversations.map(c => c.id === +m![1] ? { ...c, unreadCount: 0 } : c);
      return json({});
    }
    if ((m = path.match(/^\/chat\/conversations\/(\d+)\/pinned$/))) return json([]);
    if ((m = path.match(/^\/chat\/conversations\/(\d+)$/))) {
      const id = +m[1];
      const members = (id === 10 ? [1, 5, 6] : [1, 6]).map(userId => ({ userId, fullName: NAMES[userId], role: 'Member' }));
      return json({ id, type: id === 10 ? 'Group' : 'Direct', groupName: id === 10 ? 'Sprint Team' : undefined, createdAt: iso(999), myRole: 'Admin', members });
    }
    if (path === '/chat/messages' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}');
      this.sent.push(body);
      const msg = this.message(body.conversationId, ME.id, body.content);
      setTimeout(() => void this.push('ReceiveMessage', msg), 30);   // the server echoes to every tab
      return json(msg);
    }
    if (/count|summary|stats|today|dashboard|status/i.test(path)) return json({});
    return json([]);
  }

  /** Log in through the real login form, then land on the dashboard */
  async login() {
    await this.page.goto('/login');
    await this.page.fill('input[type=email]', ME.email);
    await this.page.fill('input[type=password]', 'secret123');
    await this.page.locator('button[type=submit]').last().click();
    await this.page.waitForURL(url => url.pathname === '/');
  }

  /** Client-side navigation (keeps the signed-in session, like clicking a link) */
  async navigate(to: string) {
    await this.page.evaluate(path => {
      history.pushState({}, '', path);
      dispatchEvent(new PopStateEvent('popstate'));
    }, to);
  }

  historyRequestsFor(conversationId: number) {
    return this.messages.requests.filter(r => r.conversationId === conversationId);
  }
}

/** Message bubbles currently rendered inside `scope` (optionally only those containing `text`) */
export const bubbles = (page: Page, scope = 'main', text?: string) =>
  page.locator(`${scope} [id^="msg-"]`, text ? { hasText: text } : undefined);

export const expectNoEmptyState = async (page: Page) =>
  expect(page.getByText('No messages yet', { exact: true })).toHaveCount(0);
