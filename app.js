const storageKey = "officeChoresData";

const state = {
  members: [],
  chores: [],
  viewDate: new Date(),
  selectedDate: new Date(),
};

const memberListEl = document.getElementById("memberList");
const memberNameEl = document.getElementById("memberName");
const addMemberBtn = document.getElementById("addMemberBtn");
const calendarGridEl = document.getElementById("calendarGrid");
const monthLabelEl = document.getElementById("monthLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const todayBtn = document.getElementById("todayBtn");
const selectedDateLabelEl = document.getElementById("selectedDateLabel");
const dayChoresEl = document.getElementById("dayChores");
const addChoreBtn = document.getElementById("addChoreBtn");
const choreModal = document.getElementById("choreModal");
const choreForm = document.getElementById("choreForm");

const choreTitleEl = document.getElementById("choreTitle");
const choreAssigneeEl = document.getElementById("choreAssignee");
const choreDateEl = document.getElementById("choreDate");
const choreTimeEl = document.getElementById("choreTime");
const choreDurationEl = document.getElementById("choreDuration");
const choreRecurrenceEl = document.getElementById("choreRecurrence");
const recurrenceIntervalWrap = document.getElementById("recurrenceIntervalWrap");
const recurrenceIntervalEl = document.getElementById("recurrenceInterval");
const recurrenceUnitEl = document.getElementById("recurrenceUnit");
const recurrenceEndEl = document.getElementById("recurrenceEnd");

const defaultMembers = [
  { id: "m1", name: "Avery" },
  { id: "m2", name: "Jordan" },
  { id: "m3", name: "Riley" },
];

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    members: state.members,
    chores: state.chores,
  }));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    state.members = [...defaultMembers];
    state.chores = [];
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state.members = parsed.members || [...defaultMembers];
    state.chores = parsed.chores || [];
  } catch {
    state.members = [...defaultMembers];
    state.chores = [];
  }
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMonth(date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function combineDateTime(dateStr, timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const date = parseDate(dateStr);
  date.setHours(h, m, 0, 0);
  return date;
}

function normalizeDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonthsPreserveDay(date, months) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const target = new Date(year, month + months, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInMonth));
  return target;
}

function getMemberName(id) {
  if (!id) return "Unassigned";
  const member = state.members.find((item) => item.id === id);
  return member ? member.name : "Unassigned";
}

function updateMemberSelect() {
  choreAssigneeEl.innerHTML = "";
  const unassigned = document.createElement("option");
  unassigned.value = "";
  unassigned.textContent = "Unassigned";
  choreAssigneeEl.appendChild(unassigned);

  state.members.forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = member.name;
    choreAssigneeEl.appendChild(option);
  });
}

function renderMembers() {
  memberListEl.innerHTML = "";
  state.members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "member";

    const name = document.createElement("span");
    name.textContent = member.name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.textContent = "�";
    removeBtn.title = "Remove member";
    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeMember(member.id);
    });

    row.appendChild(name);
    row.appendChild(removeBtn);
    memberListEl.appendChild(row);
  });
  updateMemberSelect();
}

function addMember() {
  const name = memberNameEl.value.trim();
  if (!name) return;
  state.members.push({
    id: `m${Date.now()}`,
    name,
  });
  memberNameEl.value = "";
  saveState();
  renderMembers();
  renderCalendar();
  renderSelectedDay();
}

function removeMember(memberId) {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  const confirmed = window.confirm(`Remove ${member.name}? Assigned chores will become unassigned.`);
  if (!confirmed) return;

  state.members = state.members.filter((item) => item.id !== memberId);
  state.chores = state.chores.map((chore) => {
    if (chore.assigneeId === memberId) {
      return { ...chore, assigneeId: "" };
    }
    return chore;
  });
  saveState();
  renderMembers();
  renderCalendar();
  renderSelectedDay();
}

function setRecurrenceUI() {
  const value = choreRecurrenceEl.value;
  if (value === "none" || value === "weekdays") {
    recurrenceIntervalWrap.style.display = "none";
  } else {
    recurrenceIntervalWrap.style.display = "grid";
  }

  const unitMap = {
    daily: "day(s)",
    weekly: "week(s)",
    monthly: "month(s)",
  };
  recurrenceUnitEl.textContent = unitMap[value] || "day(s)";
}

function openChoreModal() {
  choreForm.reset();
  choreDateEl.value = toISODate(state.selectedDate);
  choreTimeEl.value = "09:00";
  recurrenceIntervalEl.value = 1;
  setRecurrenceUI();
  choreModal.showModal();
}

function handleChoreSubmit(event) {
  event.preventDefault();
  const title = choreTitleEl.value.trim();
  if (!title) return;

  const recurrenceType = choreRecurrenceEl.value;
  const recurrence = {
    type: recurrenceType,
    interval: recurrenceType === "none" || recurrenceType === "weekdays" ? 1 : Number(recurrenceIntervalEl.value || 1),
    endDate: recurrenceEndEl.value || "",
  };

  const chore = {
    id: `c${Date.now()}`,
    title,
    assigneeId: choreAssigneeEl.value,
    date: choreDateEl.value,
    time: choreTimeEl.value,
    duration: Number(choreDurationEl.value || 30),
    recurrence,
  };

  state.chores.push(chore);
  saveState();
  choreModal.close();
  renderCalendar();
  renderSelectedDay();
}

function removeChore(choreId) {
  const chore = state.chores.find((item) => item.id === choreId);
  if (!chore) return;
  const confirmed = window.confirm(`Delete chore "${chore.title}"? This removes the entire series.`);
  if (!confirmed) return;
  state.chores = state.chores.filter((item) => item.id !== choreId);
  saveState();
  renderCalendar();
  renderSelectedDay();
}

function getCalendarRange(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(firstOfMonth, -firstOfMonth.getDay());
  const end = addDays(start, 41);
  return { start, end };
}

function occursWithin(chore, rangeStart, rangeEnd) {
  const occurrences = [];
  const startDate = parseDate(chore.date);
  const rangeStartDay = normalizeDate(rangeStart);
  const rangeEndDay = normalizeDate(rangeEnd);
  const recurrence = chore.recurrence || { type: "none", interval: 1, endDate: "" };
  const recurrenceEnd = recurrence.endDate ? parseDate(recurrence.endDate) : null;

  let cursor = new Date(startDate);
  let stepDays = 1;

  while (cursor <= rangeEndDay) {
    if (recurrenceEnd && cursor > recurrenceEnd) break;

    const isWeekday = cursor.getDay() !== 0 && cursor.getDay() !== 6;
    const isInRange = cursor >= rangeStartDay && cursor <= rangeEndDay;

    if (isInRange) {
      if (recurrence.type === "weekdays") {
        if (isWeekday) occurrences.push(cursor);
      } else {
        occurrences.push(cursor);
      }
    }

    if (recurrence.type === "none") break;

    if (recurrence.type === "daily") {
      stepDays = recurrence.interval;
      cursor = addDays(cursor, stepDays);
      continue;
    }

    if (recurrence.type === "weekdays") {
      cursor = addDays(cursor, 1);
      continue;
    }

    if (recurrence.type === "weekly") {
      stepDays = 7 * recurrence.interval;
      cursor = addDays(cursor, stepDays);
      continue;
    }

    if (recurrence.type === "monthly") {
      cursor = addMonthsPreserveDay(cursor, recurrence.interval);
      continue;
    }

    cursor = addDays(cursor, 1);
  }

  return occurrences;
}

function getOccurrencesInRange(rangeStart, rangeEnd) {
  const result = [];
  state.chores.forEach((chore) => {
    const dates = occursWithin(chore, rangeStart, rangeEnd);
    dates.forEach((date) => {
      result.push({
        date: normalizeDate(date),
        chore,
      });
    });
  });
  return result;
}

function renderCalendar() {
  calendarGridEl.innerHTML = "";
  monthLabelEl.textContent = formatMonth(state.viewDate);

  const { start, end } = getCalendarRange(state.viewDate);
  const occurrences = getOccurrencesInRange(start, end);

  let cursor = new Date(start);
  for (let i = 0; i < 42; i += 1) {
    const cellDate = normalizeDate(cursor);
    const cell = document.createElement("div");
    cell.className = "day-cell";

    if (cellDate.getMonth() !== state.viewDate.getMonth()) {
      cell.classList.add("outside");
    }

    if (cellDate.toDateString() === state.selectedDate.toDateString()) {
      cell.classList.add("selected");
    }

    const choresForDay = occurrences.filter((item) => item.date.toDateString() === cellDate.toDateString());
    choresForDay.sort((a, b) => a.chore.time.localeCompare(b.chore.time));

    const header = document.createElement("div");
    header.className = "day-header";

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = cellDate.getDate();

    const badge = document.createElement("div");
    badge.className = "day-badge";
    badge.textContent = choresForDay.length ? `${choresForDay.length} chores` : "Open";

    header.appendChild(number);
    header.appendChild(badge);
    cell.appendChild(header);

    const preview = choresForDay.slice(0, 3);
    preview.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "chore-chip";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.chore.title;

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${item.chore.time} � ${getMemberName(item.chore.assigneeId)}`;

      chip.appendChild(name);
      chip.appendChild(meta);
      cell.appendChild(chip);
    });

    cell.addEventListener("click", () => {
      state.selectedDate = cellDate;
      renderCalendar();
      renderSelectedDay();
    });

    calendarGridEl.appendChild(cell);
    cursor = addDays(cursor, 1);
  }
}

function renderSelectedDay() {
  const dateLabel = formatDate(state.selectedDate);
  selectedDateLabelEl.textContent = dateLabel;

  const dayStart = normalizeDate(state.selectedDate);
  const dayEnd = normalizeDate(state.selectedDate);
  const occurrences = getOccurrencesInRange(dayStart, dayEnd)
    .filter((item) => item.date.toDateString() === dayStart.toDateString())
    .sort((a, b) => a.chore.time.localeCompare(b.chore.time));

  dayChoresEl.innerHTML = "";

  if (occurrences.length === 0) {
    const empty = document.createElement("div");
    empty.className = "day-card";
    empty.textContent = "No chores scheduled. Add one above.";
    dayChoresEl.appendChild(empty);
    return;
  }

  occurrences.forEach((item) => {
    const card = document.createElement("div");
    card.className = "day-card";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.chore.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.chore.time} � ${item.chore.duration} mins � ${getMemberName(item.chore.assigneeId)}`;

    const recurrence = document.createElement("div");
    recurrence.className = "meta";
    recurrence.textContent = describeRecurrence(item.chore.recurrence);

    const actions = document.createElement("div");
    actions.className = "actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn ghost";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => removeChore(item.chore.id));

    actions.appendChild(deleteBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(recurrence);
    card.appendChild(actions);
    dayChoresEl.appendChild(card);
  });
}

function describeRecurrence(recurrence) {
  if (!recurrence || recurrence.type === "none") return "One-time";
  if (recurrence.type === "weekdays") return "Repeats on weekdays";
  const unitMap = {
    daily: "day",
    weekly: "week",
    monthly: "month",
  };
  const unit = unitMap[recurrence.type] || "day";
  const interval = recurrence.interval || 1;
  const end = recurrence.endDate ? ` until ${recurrence.endDate}` : "";
  return `Repeats every ${interval} ${unit}${interval > 1 ? "s" : ""}${end}`;
}

function init() {
  loadState();
  renderMembers();
  setRecurrenceUI();
  updateMemberSelect();
  renderCalendar();
  renderSelectedDay();
}

addMemberBtn.addEventListener("click", addMember);
memberNameEl.addEventListener("keypress", (event) => {
  if (event.key === "Enter") addMember();
});

prevMonthBtn.addEventListener("click", () => {
  state.viewDate = addMonthsPreserveDay(state.viewDate, -1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  state.viewDate = addMonthsPreserveDay(state.viewDate, 1);
  renderCalendar();
});

todayBtn.addEventListener("click", () => {
  state.viewDate = new Date();
  state.selectedDate = new Date();
  renderCalendar();
  renderSelectedDay();
});

addChoreBtn.addEventListener("click", openChoreModal);

choreRecurrenceEl.addEventListener("change", setRecurrenceUI);

choreForm.addEventListener("submit", handleChoreSubmit);

choreModal.addEventListener("close", () => {
  choreForm.reset();
  setRecurrenceUI();
});

init();

