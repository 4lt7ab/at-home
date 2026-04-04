# tab-at-home User Guide

A daily home task manager for tracking chores, maintenance, and recurring household work. Open it once a day, see what needs doing, mark things done, and move on.

---

## Getting Started

When you open the app, you land on the **Today** page. This is your daily check-in -- a summary of everything that needs attention right now.

The top bar has three navigation tabs:

- **Today** -- your daily summary (the default view)
- **Tasks** -- the full list of all your tasks
- **Notes** -- standalone notes and task-linked notes

On the right side of the top bar you will find a theme toggle button and a small colored dot. The dot is green when the app has a live connection to the server; red means it is disconnected (more on that below).

---

## Daily Check-In Workflow

The Today page is designed for a quick daily review. Here is the typical flow:

1. **Open the app.** You see today's date and three sections of tasks.
2. **Handle overdue items first.** These are tasks that were due on a previous day but were not completed. They appear in red at the top, sorted by how many days overdue they are.
3. **Work through due-today items.** These are tasks scheduled for today, sorted alphabetically.
4. **Glance at upcoming items.** These are tasks due within the next several days, so you can plan ahead.
5. **Mark tasks done.** Each item has a "Done" button on the right. Press it to complete the task.
6. **Add a completion note (optional).** Click "+ note" under the Done button to expand a text field. Type a short note about what you did, then press Done. The note is saved alongside the completion record.

When nothing is due, the page shows "All clear -- Nothing due today. Enjoy your free time."

### Understanding the Three Sections

**Overdue** -- Tasks whose scheduled due date has already passed. The badge shows how many days overdue (e.g., "3d overdue"). These stay visible until you mark them done. Overdue items are sorted with the most overdue first.

**Due Today** -- Tasks scheduled for today. Sorted alphabetically by title.

**Upcoming** -- Tasks due within a lookahead window (the next several days). Shows the actual due date for each item. This helps you plan ahead and tackle things early if you have time.

Tasks that are paused or archived never appear on the Today page. Only active tasks with a schedule show up here.

### Clicking an Item for Details

Click on any task title in the Today page to open a detail overlay. This read-only popup shows:

- The task's status, area, and effort level
- Its full description (if any)
- Schedule information (recurrence type, next due date, last completed date)
- Linked notes (up to 5, with content previewed)
- Completion history

Close the overlay by clicking the X button, clicking outside the popup, or pressing Escape.

---

## Managing Tasks

### Creating a Task

1. Go to the **Tasks** page.
2. Click **+ New Task** in the top right.
3. Fill in the form:
   - **Title** (required) -- a short name for the task
   - **Description** (optional) -- longer details about what the task involves
   - **Area** (optional) -- which part of the home this relates to (see Areas below)
   - **Effort** (optional) -- how much work this is: trivial, low, medium, or high
4. Click **Create**.

New tasks start with an "active" status and no schedule. They will not appear on the Today page until you attach a schedule.

### Editing a Task

1. From the **Tasks** page, click on a task card to open its detail page.
2. Edit any field directly:
   - Click the title text to change it
   - Use the dropdown menus to change status, area, or effort
   - Type in the description box to add or edit the description
3. A **Save Changes** button appears whenever you have unsaved edits. Click it to save.

### Task Statuses

Every task has one of four statuses:

- **Active** -- the task is in play. If it has a schedule, it will appear on the Today page when due. Shown with a green dot.
- **Paused** -- the task is temporarily on hold. It will not appear on the Today page. Shown with an orange dot. Use this for seasonal tasks or things you want to skip for a while.
- **Done** -- the task is finished. For one-time tasks, this is the final state. Shown with a gray dot.
- **Archived** -- the task is retired and hidden from normal views. Shown with a very faint dot.

### Task Lifecycle

**One-time tasks** (no schedule, or a "once" schedule): When you mark them done, their status changes to "done" and they are finished.

**Recurring tasks** (daily, weekly, monthly, etc.): When you mark them done, the task stays "active" and the schedule advances to the next due date. The task will reappear on the Today page when its next occurrence is due. This way you never have to recreate recurring tasks.

### Filtering Tasks

On the Tasks page, use the dropdown filters at the top to narrow the list:

- **Status filter** -- show only active, paused, done, or archived tasks. Defaults to showing active tasks.
- **Area filter** -- show only tasks in a specific area (kitchen, yard, etc.).

---

## Setting Up Schedules

A schedule tells the app when a task is due. Without a schedule, a task exists in your list but will not appear on the Today page.

### Adding a Schedule

1. Open a task's detail page (click on it from the Tasks list).
2. Scroll down to the **Schedule** section.
3. Click **+ Add schedule**.
4. In the overlay form:
   - **Recurrence Type** -- choose how often the task repeats
   - **Next Due** -- set the first due date (YYYY-MM-DD format, or use the date picker)
   - **Recurrence Rule** -- a JSON configuration for the schedule details (see below)
5. Click **Save**.

### Editing or Removing a Schedule

Once a schedule exists, the Schedule section shows its details: the recurrence type, next due date, and last completed date. Click **Edit** to modify it or **Remove** to delete it.

### Recurrence Types

**Once** -- a single occurrence. After completion, the schedule is exhausted and the task is marked done. Good for one-time chores like "fix the leaky faucet."
- Rule example: `{"type": "once", "date": "2026-04-15"}`

**Daily** -- repeats every N days. An interval of 1 means every day; an interval of 3 means every third day.
- Rule example: `{"type": "daily", "interval": 1}` (every day)
- Rule example: `{"type": "daily", "interval": 3}` (every 3 days)

**Weekly** -- repeats on specific days of the week. Days are numbered 0 (Sunday) through 6 (Saturday). You can optionally set an interval for every-other-week or less frequent patterns.
- Rule example: `{"type": "weekly", "days": [1, 3, 5]}` (Monday, Wednesday, Friday)
- Rule example: `{"type": "weekly", "days": [2], "interval": 2}` (every other Tuesday)

**Monthly** -- repeats on a specific day of the month. If the month does not have that many days (e.g., day 31 in February), it uses the last day of the month instead.
- Rule example: `{"type": "monthly", "day": 1}` (first of every month)
- Rule example: `{"type": "monthly", "day": 15, "interval": 3}` (every 3 months on the 15th -- quarterly)

**Seasonal** -- repeats once a year at a specific month and day. The season label (spring, summer, fall, winter) is for display purposes -- the actual due date is determined by the month and day you set.
- Rule example: `{"type": "seasonal", "season": "spring", "month": 3, "day": 15}` (March 15 each year)
- Rule example: `{"type": "seasonal", "season": "fall", "month": 10, "day": 1}` (October 1 each year)

**Custom** -- repeats every N days, like daily but for longer intervals. Use this for things like "every 45 days" or "every 90 days."
- Rule example: `{"type": "custom", "interval_days": 45}` (every 45 days)

### How the Schedule Advances

When you complete a recurring task, the next due date is calculated from the **previous due date**, not from today. This preserves the schedule's rhythm even if you complete a task late. For example, if a daily task was due Monday but you complete it on Wednesday, the next due date becomes Tuesday (one day after the previous due date), not Thursday.

For one-time ("once") schedules, completing the task sets the task status to "done" and the schedule is finished.

---

## Working with Notes

Notes are short text entries -- think of them as sticky notes or a message board. They come in two varieties:

### Standalone Notes

Notes that are not linked to any task. Use these for general reminders, grocery lists, messages to yourself, or anything that does not belong to a specific task.

To create a standalone note:
1. Go to the **Notes** page.
2. Click **+ New Note**.
3. Enter a title and optional content.
4. Leave the task dropdown set to "Standalone (no task)."
5. Click **Create**.

### Task-Linked Notes

Notes attached to a specific task. These appear in the task's detail page under the Notes section. Use them to track information related to a task -- product names, measurements, instructions, or anything you will need when working on that task.

To create a task-linked note:
- **From the Notes page:** Click + New Note, fill in the title and content, and select a task from the dropdown.
- **From a task's detail page:** Scroll to the Notes section and click "+ Add note." Fill in the title and optional content, then click "Add Note."

### Completion Notes

When you mark a task done (from either the Today page or a task's detail page), you can optionally add a completion note. Click "+ note" before pressing Done, type your note, then press Done. The completion note is automatically saved and linked to the task. This is useful for recording what you did, what supplies you used, or anything you want to remember for next time.

### Filtering Notes

The Notes page has three filter buttons at the top:
- **All** -- shows every note
- **Linked** -- shows only notes attached to a task
- **Standalone** -- shows only notes with no task association

Each note card shows which task it belongs to (if any), and whether it has content beyond just a title.

---

## Areas

Areas categorize tasks by where in the home the work happens. Assigning an area is optional but helps with filtering and at-a-glance organization. The available areas are:

| Area | What it covers |
|------|---------------|
| Kitchen | Cooking, appliances, counters, pantry |
| Bathroom | Fixtures, cleaning, plumbing in bathrooms |
| Bedroom | Bedrooms, closets, linens |
| Living room | Main living spaces, furniture, entertainment |
| Garage | Garage organization, tools, vehicles |
| Yard | Lawn, garden, outdoor spaces |
| Basement | Below-grade spaces, storage |
| Attic | Above-grade storage, insulation |
| Office | Home office, desk, tech setup |
| Exterior | Outside walls, roof, gutters, driveway |
| HVAC | Heating, cooling, air filters, ductwork |
| Plumbing | Pipes, water heater, drains (whole-house) |
| Electrical | Wiring, outlets, breaker panel, lighting |
| General | Anything that does not fit a specific area |

On the Tasks page, use the area dropdown filter to show only tasks for a particular area. On the Today page, each task's area is shown as a badge next to its title.

---

## UI Features

### Dark Mode

The theme toggle button in the top bar cycles through three modes:

- **Auto** (half-circle icon) -- follows your operating system's light/dark preference. If your OS switches to dark mode at night, the app follows automatically.
- **Light** (sun icon) -- forces light mode regardless of OS setting.
- **Dark** (moon icon) -- forces dark mode regardless of OS setting.

Your choice is remembered between sessions.

### List and Gallery Views

The Tasks and Notes pages support two view modes:

- **List view** (default) -- single-column cards, one per row
- **Gallery view** -- a multi-column grid that shows more items at once

Toggle between them by:
- Clicking the **List/Grid** button in the page header
- Pressing **Shift+G** anywhere in the app (as long as you are not typing in a text field)

Your view preference is shared across both pages and remembered between sessions.

### Real-Time Updates

The green dot in the top bar indicates a live connection to the server. When connected, any changes -- whether made in another browser tab, through the API, or via an AI assistant -- appear automatically without refreshing the page. If the dot turns red, the app will attempt to reconnect automatically.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Shift+G | Toggle between list and gallery view |
| Escape | Close any open overlay or popup |

Keyboard shortcuts are disabled while you are typing in a text field, so they will not interfere with normal input.
