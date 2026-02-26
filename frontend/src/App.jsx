import React, { useMemo, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

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

function occursWithin(chore, rangeStart, rangeEnd) {
  const occurrences = [];
  const startDate = parseDate(chore.date);
  const rangeStartDay = normalizeDate(rangeStart);
  const rangeEndDay = normalizeDate(rangeEnd);
  const recurrence = chore.recurrence || { type: "none", interval: 1, endDate: "" };
  const recurrenceEnd = recurrence.endDate ? parseDate(recurrence.endDate) : null;

  let cursor = new Date(startDate);

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
      cursor = addDays(cursor, recurrence.interval || 1);
      continue;
    }

    if (recurrence.type === "weekdays") {
      cursor = addDays(cursor, 1);
      continue;
    }

    if (recurrence.type === "weekly") {
      cursor = addDays(cursor, 7 * (recurrence.interval || 1));
      continue;
    }

    if (recurrence.type === "monthly") {
      cursor = addMonthsPreserveDay(cursor, recurrence.interval || 1);
      continue;
    }

    cursor = addDays(cursor, 1);
  }

  return occurrences;
}

function getCalendarRange(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(firstOfMonth, -firstOfMonth.getDay());
  const end = addDays(start, 41);
  return { start, end };
}

async function apiFetch(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  if (response.status === 204) return null;
  return response.json();
}

export default function App() {
  const [members, setMembers] = useState([]);
  const [chores, setChores] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [memberName, setMemberName] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const modalRef = useRef(null);
  const [formState, setFormState] = useState({
    title: "",
    assigneeId: "",
    date: toISODate(new Date()),
    time: "09:00",
    duration: 30,
    recurrenceType: "none",
    recurrenceInterval: 1,
    recurrenceEnd: "",
  });

  React.useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setError("");
      const membersRes = await apiFetch("/api/members", {}, token);
      const choresRes = await apiFetch("/api/chores", {}, token);
      setMembers(membersRes.members || []);
      setChores(choresRes.chores || []);
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  function getMemberName(id) {
    if (!id) return "Unassigned";
    const member = members.find((item) => item.id === id);
    return member ? member.name : "Unassigned";
  }

  async function handleAddMember() {
    const name = memberName.trim();
    if (!name) return;
    try {
      setError("");
      const res = await apiFetch(
        "/api/members",
        {
          method: "POST",
          body: JSON.stringify({ name }),
        },
        token
      );
      setMembers((prev) => [...prev, res.member]);
      setMemberName("");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function handleRemoveMember(id) {
    if (!window.confirm("Remove this member? Assigned chores will become unassigned.")) return;
    try {
      setError("");
      await apiFetch(`/api/members/${id}`, { method: "DELETE" }, token);
      setMembers((prev) => prev.filter((item) => item.id !== id));
      setChores((prev) =>
        prev.map((item) => (item.assigneeId === id ? { ...item, assigneeId: "" } : item))
      );
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  function openModal() {
    setFormState((prev) => ({
      ...prev,
      date: toISODate(selectedDate),
    }));
    modalRef.current?.showModal();
  }

  function closeModal() {
    modalRef.current?.close();
  }

  async function handleAddChore(event) {
    event.preventDefault();
    if (!formState.title.trim()) return;

    const payload = {
      title: formState.title.trim(),
      assigneeId: formState.assigneeId,
      date: formState.date,
      time: formState.time,
      duration: Number(formState.duration || 30),
      recurrence: {
        type: formState.recurrenceType,
        interval:
          formState.recurrenceType === "none" || formState.recurrenceType === "weekdays"
            ? 1
            : Number(formState.recurrenceInterval || 1),
        endDate: formState.recurrenceEnd || "",
      },
    };

    try {
      setError("");
      const res = await apiFetch(
        "/api/chores",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        token
      );
      setChores((prev) => [...prev, res.chore]);
      closeModal();
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function handleRemoveChore(id) {
    if (!window.confirm("Delete this chore? This removes the entire series.")) return;
    try {
      setError("");
      await apiFetch(`/api/chores/${id}`, { method: "DELETE" }, token);
      setChores((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  const { start, end } = useMemo(() => getCalendarRange(viewDate), [viewDate]);
  const occurrences = useMemo(() => {
    const result = [];
    chores.forEach((chore) => {
      const dates = occursWithin(chore, start, end);
      dates.forEach((date) => {
        result.push({ date: normalizeDate(date), chore });
      });
    });
    return result;
  }, [chores, start, end]);

  const selectedOccurrences = useMemo(() => {
    const dayStart = normalizeDate(selectedDate);
    return occurrences
      .filter((item) => item.date.toDateString() === dayStart.toDateString())
      .sort((a, b) => a.chore.time.localeCompare(b.chore.time));
  }, [occurrences, selectedDate]);

  const calendarCells = [];
  let cursor = new Date(start);
  for (let i = 0; i < 42; i += 1) {
    const cellDate = normalizeDate(cursor);
    const choresForDay = occurrences
      .filter((item) => item.date.toDateString() === cellDate.toDateString())
      .sort((a, b) => a.chore.time.localeCompare(b.chore.time));
    calendarCells.push({
      date: cellDate,
      outside: cellDate.getMonth() !== viewDate.getMonth(),
      selected: cellDate.toDateString() === selectedDate.toDateString(),
      chores: choresForDay,
    });
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">OC</div>
          <div>
            <div className="brand-title">Office Chores</div>
            <div className="brand-sub">Shared calendar for office upkeep</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => {
            setViewDate(new Date());
            setSelectedDate(new Date());
          }}>Today</button>
          <div className="month-nav">
            <button className="icon-btn" onClick={() => setViewDate(addMonthsPreserveDay(viewDate, -1))} aria-label="Previous month">&lt;</button>
            <div className="month-label">{formatMonth(viewDate)}</div>
            <button className="icon-btn" onClick={() => setViewDate(addMonthsPreserveDay(viewDate, 1))} aria-label="Next month">&gt;</button>
          </div>
          <button className="btn primary" onClick={openModal}>Add chore</button>
        </div>
      </header>

      <div className="content">
        <aside className="panel members">
          <div className="panel-header">
            <div>
              <div className="panel-title">Team Members</div>
              <div className="panel-sub">Assign chores to owners</div>
            </div>
          </div>
          <div className="member-list">
            {members.map((member) => (
              <div className="member" key={member.id}>
                <span>{member.name}</span>
                <button className="icon-btn" onClick={() => handleRemoveMember(member.id)} aria-label="Remove member">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M9 4h6l1 2h4M5 6h14M7 9v9M12 9v9M17 9v9M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="member-add">
            <input type="text" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Add member" />
            <button className="btn with-icon" type="button" onClick={handleAddMember} aria-label="Add member">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add
            </button>
          </div>
        </aside>

        <main className="calendar">
          <div className="weekday-row">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>
          <div className="calendar-grid">
            {calendarCells.map((cell) => (
              <div
                key={cell.date.toISOString()}
                className={`day-cell${cell.outside ? " outside" : ""}${cell.selected ? " selected" : ""}`}
                onClick={() => setSelectedDate(cell.date)}
                role="button"
                tabIndex={0}
              >
                <div className="day-header">
                  <div className="day-number">{cell.date.getDate()}</div>
                  <div className="day-badge">{cell.chores.length ? `${cell.chores.length} chores` : "Open"}</div>
                </div>
                {cell.chores.slice(0, 3).map((item) => (
                  <div className="chore-chip" key={`${item.chore.id}-${item.date.toISOString()}`}>
                    <div className="name">{item.chore.title}</div>
                    <div className="meta">{item.chore.time} · {getMemberName(item.chore.assigneeId)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>

        <aside className="panel day-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">{formatDate(selectedDate)}</div>
              <div className="panel-sub">Click a date to see chores</div>
            </div>
          </div>
          <div className="day-chores">
            {selectedOccurrences.length === 0 && (
              <div className="day-card">No chores scheduled. Add one above.</div>
            )}
            {selectedOccurrences.map((item) => (
              <div className="day-card" key={`${item.chore.id}-${item.date.toISOString()}`}>
                <div className="title">{item.chore.title}</div>
                <div className="meta">
                  {item.chore.time} · {item.chore.duration} mins · {getMemberName(item.chore.assigneeId)}
                </div>
                <div className="meta">{describeRecurrence(item.chore.recurrence)}</div>
                <div className="actions">
                  <button className="btn ghost" onClick={() => handleRemoveChore(item.chore.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {error && (
        <div className="error-banner">
          <div>API error: {error}</div>
          <button className="btn ghost" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <dialog className="modal" ref={modalRef}>
        <form method="dialog" className="modal-card" onSubmit={handleAddChore}>
          <div className="modal-header">
            <div>
              <div className="modal-title">New Chore</div>
              <div className="modal-sub">Add a one-time or recurring chore</div>
            </div>
            <button className="icon-btn" value="cancel" type="submit" aria-label="Close">x</button>
          </div>

          <div className="form-grid">
            <label>
              <span>Chore name</span>
              <input
                type="text"
                value={formState.title}
                onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                required
                placeholder="e.g., Restock supplies"
              />
            </label>
            <label>
              <span>Assignee</span>
              <select
                value={formState.assigneeId}
                onChange={(e) => setFormState((prev) => ({ ...prev, assigneeId: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={formState.date}
                onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </label>
            <label>
              <span>Start time</span>
              <input
                type="time"
                value={formState.time}
                onChange={(e) => setFormState((prev) => ({ ...prev, time: e.target.value }))}
                required
              />
            </label>
            <label>
              <span>Duration (mins)</span>
              <input
                type="number"
                min="15"
                step="15"
                value={formState.duration}
                onChange={(e) => setFormState((prev) => ({ ...prev, duration: e.target.value }))}
              />
            </label>
            <label>
              <span>Recurrence</span>
              <select
                value={formState.recurrenceType}
                onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceType: e.target.value }))}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
              </select>
            </label>
            {formState.recurrenceType !== "none" && formState.recurrenceType !== "weekdays" && (
              <label className="inline">
                <span>Every</span>
                <div className="inline-field">
                  <input
                    type="number"
                    min="1"
                    value={formState.recurrenceInterval}
                    onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceInterval: e.target.value }))}
                  />
                  <span>{formState.recurrenceType === "weekly" ? "week(s)" : formState.recurrenceType === "monthly" ? "month(s)" : "day(s)"}</span>
                </div>
              </label>
            )}
            <label>
              <span>Repeat until (optional)</span>
              <input
                type="date"
                value={formState.recurrenceEnd}
                onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceEnd: e.target.value }))}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button className="btn ghost" value="cancel" type="submit" onClick={closeModal}>Cancel</button>
            <button className="btn primary" type="submit">Save chore</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
