// ─────────────────────────────────────────────────────────────────────────────
//  DailyTracker user guide — English. Written from how the app actually works
//  (October 2026). Build the PDFs with:  npm run guide
// ─────────────────────────────────────────────────────────────────────────────

export const meta = {
  lang: 'en',
  file: 'DailyTracker_v2_Feature_Guide.pdf',
  title: 'DailyTracker v2 — User Guide',
  subtitle: 'How to use every feature — for employees, team leads and managers',
  updated: 'Updated 1 October 2026',
  footer: 'DailyTracker v2 · User Guide',
  contents: 'Contents',
  page: 'Page',
  of: 'of',
};

export const cover = `
  <p class="lead">DailyTracker is your team's one place for attendance, tasks, daily reports, leave, WFH,
  expenses, payroll, chat and more. This guide explains each feature in plain words, with the exact
  steps to follow.</p>
  <div class="box">
    <h3>How to read this guide</h3>
    <ul>
      <li><b>Everyone</b> — sections 1 to 14.</li>
      <li><b>Team leads and managers</b> — also section 15.</li>
      <li>All times in the app are <b>India time (IST)</b>, on every device.</li>
      <li>Menu names are shown like <span class="ui">HR &amp; Requests → Leave</span>.</li>
    </ul>
  </div>`;

export const sections = [
  {
    title: "What's new",
    sub: 'September – October 2026',
    body: `
    <table>
      <tr><th>Feature</th><th>What it does</th><th>Where</th></tr>
      <tr><td>Missed check-in</td><td>Forgot to check in? Ask to add the day with your times; once approved it counts as present.</td><td>Work Management → My Report</td></tr>
      <tr><td>Phone notifications</td><td>Approvals, reminders and chat messages arrive on your phone or computer even when the app is closed.</td><td>Notifications → Phone notifications</td></tr>
      <tr><td>New look &amp; three designs</td><td>Montcrest logo and a fresh look; pick <b>Montcrest</b>, <b>Dashdark Purple</b> or <b>Original Blue</b> — your choice follows your account.</td><td>Account menu → Design</td></tr>
      <tr><td>Menu search</td><td>Type in the sidebar's <b>Search for…</b> box to jump to any page.</td><td>Sidebar</td></tr>
      <tr><td>Comp-off</td><td>Working 4+ hours on a weekend or public holiday earns a day off.</td><td>Leave page</td></tr>
      <tr><td>Expense claims</td><td>Send a bill; once approved it is paid with your salary.</td><td>HR &amp; Requests → Expenses</td></tr>
      <tr><td>Forgotten check-out</td><td>Reminder at 7 PM; the app closes the day for you and you confirm or correct it next morning.</td><td>Dashboard</td></tr>
      <tr><td>Getting-started checklist</td><td>New joiners get a checklist and a buddy.</td><td>Dashboard</td></tr>
      <tr><td>Excel downloads</td><td>Attendance, leave, reports, payroll and expenses as Excel files.</td><td>“Download Excel” buttons</td></tr>
      <tr><td>Hand over approvals</td><td>A manager going on leave lets a colleague decide their team's requests.</td><td>Employee Requests</td></tr>
      <tr><td>Safer sign-in</td><td>Sign-in ends when the browser closes (unless you trust the device) and after 30 minutes idle.</td><td>Sign-in page</td></tr>
      <tr><td>India time everywhere</td><td>Every time (check-in, meetings, AI Help answers) is shown in IST.</td><td>Whole app</td></tr>
    </table>`,
  },
  {
    title: 'Getting started',
    sub: 'Your account, signing in and security',
    body: `
    <h3>Create your account</h3>
    <ol>
      <li>Open the app and choose <span class="ui">Create employee account</span>.</li>
      <li>Enter your name, work email and a password. A code is sent to your email — type it in.</li>
      <li>Your account now waits for a manager. When they approve it and give you a role, you can sign in.</li>
    </ol>
    <h3>Signing in</h3>
    <ul>
      <li>Sign in with your <b>password</b>, or choose <b>Email OTP</b> to get a one-time code by email.</li>
      <li><b>Trust this device</b> is off by default. Leave it off on shared computers: you are signed out when the browser closes.
          Tick it only on your own device — you then stay signed in on it.</li>
      <li>After <b>30 minutes without activity</b> you are signed out for safety.</li>
    </ul>
    <h3>Two-step sign-in (recommended)</h3>
    <p>Open <span class="ui">System &amp; Docs → Security &amp; 2FA</span>. Turn on an <b>authenticator app</b>
    (scan the QR code with Google or Microsoft Authenticator) or <b>email codes</b>. Keep your backup codes safe.</p>
    <h3>Finding your way</h3>
    <ul>
      <li>The menu on the left is grouped into sections (General, Work Management, HR &amp; Requests, System &amp; Docs, and Manager for team leads and managers). Click a section name to open it.</li>
      <li>Faster: type in <span class="ui">Search for…</span> at the top of the menu — e.g. “leave” or “payroll” — and click the page.</li>
      <li>On a phone, open the menu with <b>☰</b> (top left); the bottom bar has Home, Tasks, Leave, Docs, Alerts and Profile.</li>
    </ul>
    <h3>Your look: design and light / dark</h3>
    <p>Click your name at the bottom of the menu to open the account menu. <span class="ui">Light Theme / Dark Theme</span> switches
    between light and dark, and under <b>Design</b> you can pick <b>Montcrest</b> (amber &amp; maroon, the default), <b>Dashdark Purple</b>
    or <b>Original Blue</b>. The design is saved on your account, so it is the same on your phone and computer.</p>
    <h3>Phone notifications</h3>
    <ol>
      <li>Open <span class="ui">General → Notifications</span>. At the top is the <b>Phone notifications</b> card.</li>
      <li>Tap <span class="ui">Turn on</span> and allow notifications when the browser asks.</li>
      <li>Tap <span class="ui">Send test</span> — a test notification should appear within a few seconds.</li>
    </ol>
    <p>You then get every bell notification (approvals, reminders, comp-off, expenses …) and chat messages while DailyTracker is closed.
    Turn it on separately on each device you use; the card lists your devices. <span class="ui">Turn off</span> stops it on that device,
    and signing out stops it too. Muted chats don't send notifications.</p>
    <div class="tip"><b>iPhone / iPad:</b> notifications work only from the Home Screen app — in Safari tap <b>Share → Add to Home Screen</b>,
    open DailyTracker from the new icon, then turn notifications on. <b>Blocked?</b> Allow notifications for the site in the browser's
    settings (the lock icon next to the address) and try again.</div>
    <h3>Your first days — the getting-started checklist</h3>
    <p>New joiners see a <b>Getting started</b> card on the dashboard with a progress bar. Some steps tick themselves
    when you do them in the app (profile details, face check-in, two-step sign-in, uploading a document, your first check-in);
    tick the others yourself. Your <b>buddy</b> — a colleague who helps you settle in — is named on the card.</p>
    <div class="tip">Install the app on your phone: open it in Chrome and choose <b>Add to Home screen</b>.
    When a new version is released the app updates itself within a minute; you may see a “New version available” banner.</div>`,
  },
  {
    title: 'Your working day',
    sub: 'Check-in, breaks, check-out',
    body: `
    <h3>Check in</h3>
    <ol>
      <li>On the dashboard press <span class="ui">Check In</span>.</li>
      <li>Allow location access. You must be at the office (within the distance your company set, e.g. 300 m).</li>
      <li>If face check-in is set up, look at the camera for a moment.</li>
    </ol>
    <p>On an approved <b>WFH</b> or <b>half day</b>, and on weekends and holidays, the location check is skipped.
    A late check-in may ask for a short reason.</p>
    <h3>Breaks</h3>
    <p>Start a <b>Tea</b>, <b>Lunch</b> or <b>Other</b> break and end it when you are back. Break time is not counted as work.
    Checking out ends a running break automatically.</p>
    <h3>Check out</h3>
    <p>Press <span class="ui">Check Out</span> at the end of the day. Your work hours = time from check-in to check-out minus breaks.</p>
    <h3>If you forget to check out</h3>
    <ul>
      <li>At <b>7 PM</b> you get a reminder if you are still checked in.</li>
      <li>If the day is still open at <b>5 AM</b> next morning, the app closes it at your <b>last activity</b>
          (last task, support log, break or chat message) — or after a normal 8-hour day if that is later. Late work keeps its overtime.</li>
      <li>Next morning the dashboard asks you: press <span class="ui">That's right</span>, or
          <span class="ui">I finished at a different time</span> and send the real time with a reason. Your team lead or manager approves it and your hours are updated.</li>
    </ul>
    <h3>If you forgot to check in</h3>
    <ol>
      <li>Open <span class="ui">Work Management → My Report</span>. Absent days are red in the calendar — tap the day you worked.</li>
      <li>In <b>Forgot to check in?</b> enter your check-in and check-out times (India time), choose <b>At the office</b> or <b>Work from home</b>, and give a short reason.</li>
      <li>Press <span class="ui">Send for approval</span>. Your team lead or manager decides on Employee Requests.</li>
    </ol>
    <p>Once approved, the day counts as present (or WFH) in your attendance, absences and payroll. Any working day from the last
    30 days can be added — not weekends or holidays (that work earns comp-off), days on approved leave, or days you already checked in.
    You can cancel a request while it is still pending.</p>`,
  },
  {
    title: 'Tasks, goals and support',
    sub: 'Planning and logging your work',
    body: `
    <h3>Tasks</h3>
    <ul>
      <li>Add tasks with a project, priority (High / Medium / Low), tags and time spent.</li>
      <li>Status: <b>In Progress</b>, <b>Completed</b>, <b>Blocked</b> or <b>On Hold</b>. Use the list or the Kanban board.</li>
      <li><b>Task timer</b>: start / stop a timer on a task and the time is added for you.</li>
      <li><b>Templates</b>: save routine tasks once; recurring ones appear on the right days and are added in one click.</li>
    </ul>
    <h3>Daily goals</h3>
    <p>Each morning set how many tasks and hours you aim for (a reminder comes at 9 AM). The dashboard shows your progress;
    <span class="ui">Goal History</span> shows the last 7, 14 or 30 days.</p>
    <h3>Support</h3>
    <p>Log help you gave a colleague (who, what, how long, with screenshots or files). Managers can assign support engineers to developers.</p>`,
  },
  {
    title: 'End-of-day report (EOD)',
    sub: 'A short summary of your day',
    body: `
    <p>Open <span class="ui">EOD Report</span> and fill in what you did, blockers, tomorrow's plan, what you learned and your mood.
    Press <span class="ui">Auto-Generate Draft</span> to get a first version written from today's check-in time, hours and tasks — then edit it.</p>
    <p>A reminder comes at <b>5 PM</b> if you checked in but have not sent it. Your manager reads it, rates it and may leave feedback;
    see it under <span class="ui">My EOD Reviews</span>.</p>`,
  },
  {
    title: 'Leave and holidays',
    sub: 'Applying, balances and company holidays',
    body: `
    <table>
      <tr><th>Type</th><th>Per year</th><th>Notes</th></tr>
      <tr><td>Casual</td><td>12 days</td><td></td></tr>
      <tr><td>Sick</td><td>7 days</td><td></td></tr>
      <tr><td>Earned</td><td>15 days</td><td></td></tr>
      <tr><td>Comp-off</td><td>As earned</td><td>Days earned by weekend / holiday work (section 7)</td></tr>
      <tr><td>Unpaid</td><td>No limit</td><td>Deducted from salary</td></tr>
    </table>
    <ol>
      <li>Open <span class="ui">HR &amp; Requests → Leave</span> and press <span class="ui">Apply for Leave</span>.</li>
      <li>Choose the type, the dates and a reason, and submit.</li>
    </ol>
    <ul>
      <li>Weekends and public holidays inside your dates are <b>not counted</b>.</li>
      <li>You can't apply for days you already have leave on. You can cancel a request while it is still pending.</li>
      <li>Managers decide leave; you get a notification and an email.</li>
      <li>The <b>Company Holidays</b> tab lists this year's holidays.</li>
    </ul>`,
  },
  {
    title: 'Comp-off',
    sub: 'A day off for working on a weekend or holiday',
    body: `
    <ul>
      <li>Work <b>4 hours or more</b> on a Saturday, Sunday or public holiday and check out → you earn <b>1 comp-off day</b>.</li>
      <li>It first waits for your team lead or manager to approve it.</li>
      <li>Approved days show on the Leave page (<b>Comp-off</b> card) with the date each one runs out.</li>
      <li>Use them by applying for a <b>CompOff</b> leave. Each comp-off day must be used within <b>60 days</b> of the day you worked;
          you get a reminder a week before one runs out.</li>
      <li>If the leave is rejected or you cancel it, your comp-off days come back.</li>
    </ul>`,
  },
  {
    title: 'Work from home and half days',
    sub: 'Requests and approvals',
    body: `
    <ol>
      <li>Open <span class="ui">HR &amp; Requests → WFH Requests</span>.</li>
      <li>Choose <b>WFH</b> or <b>Half day</b> (first half or second half), the date and a reason.</li>
    </ol>
    <p>Your team lead or manager gets a notification and an email with <b>Approve / Reject</b> buttons that work without signing in
    (the link is signed and expires). Approved days appear on the team calendar and skip the office-location check.
    <span class="ui">WFH Summary</span> shows your month.</p>`,
  },
  {
    title: 'Expense claims',
    sub: 'Getting money back for work spending',
    body: `
    <ol>
      <li>Open <span class="ui">HR &amp; Requests → Expenses</span> and press <span class="ui">New claim</span>.</li>
      <li>Enter the bill date, category (Travel, Food, Internet, Office, Other), amount and what it was for.</li>
      <li>Attach the bill — a <b>PDF or photo</b>, up to 5 MB — and press <span class="ui">Send claim</span>.</li>
    </ol>
    <ul>
      <li>Up to ₹1,00,000 per claim; bills up to 90 days old; no future dates.</li>
      <li>Your team lead or manager approves it, or declines it with a reason.</li>
      <li>Approved claims are paid with <b>that month's salary</b> — the payslip shows a separate <b>Reimbursements</b> line.</li>
      <li>You can withdraw a claim while it is still waiting. Bills are private: only you and your approver can open them.</li>
    </ul>`,
  },
  {
    title: 'Reports and Excel downloads',
    sub: 'Your history in the app and in Excel',
    body: `
    <ul>
      <li><span class="ui">History</span> — your past days: check-in, check-out, hours, breaks, tasks.</li>
      <li><span class="ui">My Report</span> — any date range with totals, plus a monthly attendance calendar.
          Download it as <b>PDF</b>, <b>Word</b> or <b>Excel</b>; <b>Download month (Excel)</b> under the calendar gives that month's attendance.</li>
      <li><b>Download Excel</b> buttons are also on the Leave page (requests, balances, comp-off), Expenses, and for managers
          on Employee Requests → Monthly and on Payroll.</li>
    </ul>
    <p>Excel files have a frozen header row with filters; dates and amounts are real numbers you can sort and total.</p>`,
  },
  {
    title: 'Payroll and payslip',
    sub: 'How your pay is worked out',
    body: `
    <p>Open <span class="ui">HR &amp; Requests → Payroll</span> and choose the month. Download the payslip and print or save it as PDF.</p>
    <table>
      <tr><th>Line</th><th>How it is calculated</th></tr>
      <tr><td>Basic pay</td><td>Your full monthly salary</td></tr>
      <tr><td>Overtime</td><td>Hours beyond your daily target (8 h by default) × hourly rate × overtime rate (1.5× by default)</td></tr>
      <tr><td>Deductions</td><td>Absent days, unpaid leave, half days (½ day) and working days before your joining date × per-day rate</td></tr>
      <tr><td>Reimbursements</td><td>Expense claims approved this month</td></tr>
      <tr><td><b>Net pay</b></td><td>Basic + overtime − deductions + reimbursements</td></tr>
    </table>
    <p>Paid leave, comp-off, approved WFH and holidays are <b>not</b> deducted.</p>`,
  },
  {
    title: 'Chat, announcements and kudos',
    sub: 'Talking to your team',
    body: `
    <h3>Chat</h3>
    <ul>
      <li>Open the round chat button at the bottom right. Chat one-to-one or in groups.</li>
      <li>Send files and images, create <b>polls</b>, <b>@mention</b> someone, <b>pin</b> important messages and <b>search</b> old ones.</li>
      <li>You see who has read your message, and get notifications for new messages.</li>
    </ul>
    <h3>Announcements</h3><p>Company news from managers; pinned ones stay on top. Mark them as read.</p>
    <h3>Kudos</h3><p>Thank a colleague with a badge — Great Work, Team Player, Problem Solver, Mentor or Innovation.</p>
    <h3>Notifications</h3><p>The bell shows reminders and decisions; the Notifications page keeps the full list.</p>`,
  },
  {
    title: 'Meetings and AI Help',
    sub: 'Meeting notes, action items and the assistant',
    body: `
    <h3>Meetings</h3>
    <ul>
      <li>Create a meeting (Stand-up, Planning, Review, Retrospective, One-on-one or Other), set the date and time (IST), duration and attendees; it can repeat.</li>
      <li>Add notes and <b>action items</b> with an owner and due date; owners mark them done.</li>
    </ul>
    <h3>AI Help</h3>
    <ul>
      <li>Ask things like “How many hours have I worked today?”, “Show my recent leaves” or “Draft my EOD report”.</li>
      <li>It can also do things for you — start or end a break, check in or out, apply for WFH or leave, create a task.
          It always shows a card to confirm first.</li>
      <li>Use the microphone to speak instead of typing.</li>
    </ul>`,
  },
  {
    title: 'Documents, training, reviews and exit',
    sub: 'The rest of HR',
    body: `
    <ul>
      <li><b>Documents</b> — your offer letter, contract, ID proof, payslips, certificates and company policies. You can upload your own documents; managers can upload for you.</li>
      <li><b>Training</b> — trainings you attend and certifications you hold, with dates and status.</li>
      <li><b>Performance reviews</b> — when a review cycle starts you rate yourself; your manager then adds their review and the review is completed.</li>
      <li><b>Resignation</b> — submit your reason and preferred last day. When your manager accepts it they set your last working day, and an exit checklist
          (laptop return, access removal, handover …) is followed until your exit is complete.</li>
    </ul>`,
  },
  {
    title: 'For team leads and managers',
    sub: 'Approvals, your team and administration',
    body: `
    <h3>Employee Requests — one queue for everything</h3>
    <p><span class="ui">Manager → Employee Requests → Pending Queue</span> holds leave, WFH / half-day requests, check-out corrections,
    comp-off and expense claims. Add a note and approve or decline. The <b>Monthly</b> tab shows team attendance (with Download Excel).</p>
    <h3>Who decides what</h3>
    <ul>
      <li>A person's requests go to their own <b>team lead</b> (or manager); people without one go to every manager.</li>
      <li>Team leads decide only for their own team. <b>Leave</b> is decided by managers.</li>
      <li>Nobody approves their own request, unless there is no one else who could.</li>
    </ul>
    <h3>Going on leave? Hand over your approvals</h3>
    <p>On Employee Requests use <span class="ui">Hand over</span>: choose a manager or team lead and the dates (up to 90 days).
    For those days they decide your team's requests and get the notifications. A team lead covering for a manager can also decide leave.
    Press <span class="ui">Take back</span> to end it early.</p>
    <h3>Onboarding new joiners</h3>
    <p>Approving a new account on <span class="ui">Assign Roles</span> starts their getting-started checklist automatically.
    On <span class="ui">Manager → Onboarding</span> choose a buddy, tick your steps (laptop and accounts, welcome meeting), add or remove steps,
    and start checklists for anyone who joined in the last 90 days.</p>
    <h3>More tools</h3>
    <ul>
      <li><b>Team Dashboard</b> — who is in, WFH, on leave or not checked in today; each person's report and calendar.</li>
      <li><b>Face Setup</b> — register or reset team members' faces.</li>
      <li><b>EOD Reviews</b> (managers) — read, rate and comment on daily reports.</li>
      <li><b>Payroll</b> (managers) — set salaries and overtime rate; team payroll with Download Excel.</li>
      <li><b>System</b> (managers) — error log, weekly database backups, download and restore.</li>
    </ul>`,
  },
  {
    title: 'Automatic reminders and help',
    sub: 'What happens on its own, and common questions',
    body: `
    <table>
      <tr><th>Time (IST)</th><th>What happens</th></tr>
      <tr><td>5:00 AM</td><td>Days nobody checked out of are closed (see section 3)</td></tr>
      <tr><td>5:15 AM</td><td>Weekend / holiday work becomes comp-off; comp-off expiry reminders</td></tr>
      <tr><td>9:00 AM</td><td>Reminder to set your daily goal</td></tr>
      <tr><td>9:30 AM</td><td>Managers: requests waiting more than 2 days</td></tr>
      <tr><td>5:00 PM</td><td>Reminder to send your EOD report</td></tr>
      <tr><td>6:00 PM</td><td>Reminder if you haven't logged your day</td></tr>
      <tr><td>7:00 PM</td><td>Reminder to check out if you are still checked in</td></tr>
      <tr><td>Weekly</td><td>A full backup of the database</td></tr>
    </table>
    <h3>Common questions</h3>
    <ul>
      <li><b>I can't see a new feature.</b> Wait a minute or refresh (Ctrl + Shift + R). Many menu items are inside a section — click the section name to open it.</li>
      <li><b>Check-in says I'm too far from the office.</b> Turn on location / GPS and allow it for the site, then try again near the office.</li>
      <li><b>Face check-in fails.</b> Face the light, remove glasses or a mask, and hold still. Ask your manager to reset your face if it keeps failing.</li>
      <li><b>I don't get phone notifications.</b> Check the card on the Notifications page says “On for this device” and press <b>Send test</b>. Make sure the phone isn't in Do Not Disturb / battery saver for the browser, and on iPhone use the Home Screen app.</li>
      <li><b>The app is slow to open the first time.</b> After a quiet period the server takes up to a minute to wake up.</li>
      <li><b>A time looks wrong.</b> All times are India time; tell your manager if something doesn't match.</li>
    </ul>`,
  },
];
