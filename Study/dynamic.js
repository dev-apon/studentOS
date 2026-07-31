/* ============================================================
   STUDENTOS – Full Application (with File Manager)
   ============================================================ */

(function() {
    'use strict';

    // ------------------------------------------------------------
    //  STATE
    // ------------------------------------------------------------
    const state = {
        tasks: [],
        notes: [],
        stickies: [],
        assignments: [],
        cgpaCourses: [],
        events: [],
        files: [], // { id, name, type, size, data (base64), uploaded }
        pomodoro: { sessions: 0, totalMin: 0, streak: 0 },
        settings: { theme: 'light', accent: '#52796F', fontSize: 'medium' },
        calendarYear: 2026,
        calendarMonth: 0,
        selectedDate: null,
        pomodoroInterval: null,
        pomodoroRunning: false,
        pomodoroTime: 25 * 60,
        pomodoroMax: 25 * 60,
        pomodoroMode: '25',
        pomodoroPhase: 'focus',
        pomodoroBreak: 5 * 60,
        stopwatchInterval: null,
        stopwatchRunning: false,
        stopwatchTime: 0,
        stopwatchLaps: [],
        countdownInterval: null,
        countdownRunning: false,
        countdownTime: 5 * 60,
        countdownMax: 5 * 60,
        streak: 0,
        sidebarOpen: false,
    };

    // ------------------------------------------------------------
    //  DOM REFS
    // ------------------------------------------------------------
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ------------------------------------------------------------
    //  UTILITY
    // ------------------------------------------------------------
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function formatDate(d) {
        return d.toISOString().split('T')[0];
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function formatTimeShort(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function formatStopwatch(ms) {
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = Math.floor(totalSec % 60);
        const cs = Math.floor((ms % 1000) / 10);
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function getToday() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function isToday(date) {
        const t = getToday();
        return date.getFullYear() === t.getFullYear() &&
            date.getMonth() === t.getMonth() &&
            date.getDate() === t.getDate();
    }

    function getMonthDays(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDay(year, month) {
        return new Date(year, month, 1).getDay();
    }

    function getDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }

    function getFileIcon(type) {
        if (type.startsWith('image/')) return 'fa-file-image';
        if (type === 'application/pdf') return 'fa-file-pdf';
        if (type.startsWith('text/')) return 'fa-file-lines';
        if (type.includes('word') || type.includes('document')) return 'fa-file-word';
        if (type.includes('excel') || type.includes('sheet')) return 'fa-file-excel';
        if (type.includes('powerpoint') || type.includes('presentation')) return 'fa-file-powerpoint';
        return 'fa-file';
    }

    // ------------------------------------------------------------
    //  STORAGE
    // ------------------------------------------------------------
    function saveState() {
        try {
            const data = {
                tasks: state.tasks,
                notes: state.notes,
                stickies: state.stickies,
                assignments: state.assignments,
                cgpaCourses: state.cgpaCourses,
                events: state.events,
                files: state.files,
                pomodoro: state.pomodoro,
                settings: state.settings,
                streak: state.streak,
            };
            localStorage.setItem('studentos_data', JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('studentos_data');
            if (!raw) return;
            const data = JSON.parse(raw);
            state.tasks = data.tasks || [];
            state.notes = data.notes || [];
            state.stickies = data.stickies || [];
            state.assignments = data.assignments || [];
            state.cgpaCourses = data.cgpaCourses || [];
            state.events = data.events || [];
            state.files = data.files || [];
            state.pomodoro = data.pomodoro || { sessions: 0, totalMin: 0, streak: 0 };
            state.settings = data.settings || { theme: 'light', accent: '#52796F', fontSize: 'medium' };
            state.streak = data.streak || 0;
        } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------
    //  TOAST
    // ------------------------------------------------------------
    function showToast(message, type = 'info', duration = 3200) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info' };
        toast.innerHTML = `
            <i class="fas ${iconMap[type] || iconMap.info}"></i>
            <span>${message}</span>
            <span class="toast-close"><i class="fas fa-times"></i></span>
        `;
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
    }

    // ------------------------------------------------------------
    //  BROWSER NOTIFICATION
    // ------------------------------------------------------------
    function sendBrowserNotification(title, body) {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '📚' });
        } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') new Notification(title, { body, icon: '📚' });
            });
        }
    }

    // ------------------------------------------------------------
    //  THEME / STYLE
    // ------------------------------------------------------------
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.querySelector('#themeToggle i');
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
        document.getElementById('themeSelect').value = theme;
        state.settings.theme = theme;
        saveState();
    }

    function toggleTheme() {
        const next = state.settings.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        showToast(`Switched to ${next} mode`, 'info');
    }

    function applyAccent(color) {
        document.documentElement.style.setProperty('--secondary', color);
        document.documentElement.style.setProperty('--primary', color);
        state.settings.accent = color;
        document.getElementById('accentColorPicker').value = color;
        saveState();
    }

    function applyFontSize(size) {
        const sizes = { small: '13px', medium: '14px', large: '16px' };
        document.documentElement.style.fontSize = sizes[size] || '14px';
        state.settings.fontSize = size;
        document.getElementById('fontSizeSelect').value = size;
        saveState();
    }

    // ------------------------------------------------------------
    //  NAVIGATION
    // ------------------------------------------------------------
    function navigateTo(pageId) {
        $$('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(`page-${pageId}`);
        if (target) target.classList.add('active');

        $$('.sidebar-nav a').forEach(a => a.classList.remove('active'));
        const link = document.querySelector(`.sidebar-nav a[data-page="${pageId}"]`);
        if (link) link.classList.add('active');

        const titles = {
            dashboard: 'Dashboard',
            calendar: 'Calendar',
            tasks: 'Tasks',
            pomodoro: 'Pomodoro',
            stopwatch: 'Stopwatch',
            countdown: 'Countdown',
            quicknotes: 'Quick Notes',
            stickynotes: 'Sticky Notes',
            cgpa: 'CGPA Calculator',
            assignments: 'Assignment Tracker',
            files: 'File Manager',
            settings: 'Settings'
        };
        document.getElementById('pageTitle').textContent = titles[pageId] || pageId;

        closeSidebar();

        if (pageId === 'dashboard') renderDashboard();
        if (pageId === 'tasks') renderTasks();
        if (pageId === 'quicknotes') renderNotes();
        if (pageId === 'stickynotes') renderStickies();
        if (pageId === 'assignments') renderAssignments();
        if (pageId === 'cgpa') renderCGPA();
        if (pageId === 'files') renderFiles();
        if (pageId === 'calendar') renderCalendar();
        if (pageId === 'settings') renderSettings();
    }

    // ------------------------------------------------------------
    //  SIDEBAR
    // ------------------------------------------------------------
    function openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebarOverlay').classList.add('active');
        state.sidebarOpen = true;
    }

    function closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
        state.sidebarOpen = false;
    }

    function toggleSidebar() {
        state.sidebarOpen ? closeSidebar() : openSidebar();
    }

    // ------------------------------------------------------------
    //  DASHBOARD
    // ------------------------------------------------------------
    function renderDashboard() {
        const hour = new Date().getHours();
        let greet = 'Morning';
        if (hour >= 12 && hour < 17) greet = 'Afternoon';
        else if (hour >= 17) greet = 'Evening';
        document.getElementById('greetingTime').textContent = greet;
        document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const completed = state.tasks.filter(t => t.done).length;
        const pending = state.tasks.filter(t => !t.done).length;
        const totalSubjects = new Set(state.tasks.map(t => t.category).filter(Boolean)).size +
            new Set(state.assignments.map(a => a.subject).filter(Boolean)).size;
        document.getElementById('statCompleted').textContent = completed;
        document.getElementById('statPending').textContent = pending;
        document.getElementById('statStudyHours').textContent = Math.floor(state.pomodoro.totalMin / 60);
        document.getElementById('statSubjects').textContent = totalSubjects || 0;
        document.getElementById('statNotes').textContent = state.notes.length;

        const todayStr = getDateKey(new Date());
        const todayTasks = state.tasks.filter(t => t.due === todayStr && !t.done);
        const list = document.getElementById('todayTasksList');
        if (todayTasks.length === 0) {
            list.innerHTML = `<li class="empty-state"><i class="fas fa-inbox"></i><p>No tasks for today</p></li>`;
        } else {
            list.innerHTML = todayTasks.slice(0, 5).map(t =>
                `<li><span class="status-dot pending"></span> ${t.title}</li>`
            ).join('');
        }

        const upcoming = state.assignments.filter(a => a.status !== 'completed').sort((a, b) =>
            new Date(a.deadline) - new Date(b.deadline)
        );
        const ulist = document.getElementById('upcomingAssignmentsList');
        if (upcoming.length === 0) {
            ulist.innerHTML = `<li class="empty-state"><i class="fas fa-calendar-plus"></i><p>No upcoming assignments</p></li>`;
        } else {
            ulist.innerHTML = upcoming.slice(0, 5).map(a =>
                `<li><span class="status-dot pending"></span> ${a.title} — <span style="font-size:0.75rem;color:var(--text-secondary);">${a.deadline}</span></li>`
            ).join('');
        }

        document.getElementById('streakCount').textContent = state.streak || 0;
        document.getElementById('qTotalTasks').textContent = state.tasks.length;
        document.getElementById('qTotalNotes').textContent = state.notes.length;
        document.getElementById('qTotalAssign').textContent = state.assignments.length;
        document.getElementById('qPomodoros').textContent = state.pomodoro.sessions || 0;

        const quotes = [
            { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
            { text: "Success is the sum of small efforts, repeated daily.", author: "Robert Collier" },
            { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
            { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
            { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
            { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
            { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
            { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        ];
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        document.getElementById('dailyQuote').textContent = q.text;
        document.getElementById('quoteAuthor').textContent = q.author;
    }

    // ------------------------------------------------------------
    //  CALENDAR
    // ------------------------------------------------------------
    function renderCalendar() {
        const year = state.calendarYear;
        const month = state.calendarMonth;
        const daysInMonth = getMonthDays(year, month);
        const firstDay = getFirstDay(year, month);
        const today = getToday();

        document.getElementById('calendarMonthYear').textContent =
            new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const grid = document.getElementById('calendarGrid');
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = dayLabels.map(l => `<div class="day-label">${l}</div>`).join('');

        for (let i = 0; i < firstDay; i++) {
            html += `<div class="day other-month"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const key = getDateKey(dateObj);
            const isToday = isToday(dateObj);
            const hasEvent = state.events.some(e => e.date === key);
            const selected = state.selectedDate && getDateKey(state.selectedDate) === key;
            let classes = 'day';
            if (isToday) classes += ' today';
            if (hasEvent) classes += ' has-event';
            if (selected) classes += ' selected';
            html += `<div class="${classes}" data-date="${key}">${d}</div>`;
        }

        grid.innerHTML = html;

        grid.querySelectorAll('.day:not(.other-month)').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.dataset.date;
                const parts = key.split('-').map(Number);
                state.selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
                renderCalendar();
                renderEvents();
            });
        });

        if (!state.selectedDate) {
            state.selectedDate = new Date(today);
            renderCalendar();
        }
        renderEvents();
    }

    function renderEvents() {
        const key = state.selectedDate ? getDateKey(state.selectedDate) : getDateKey(new Date());
        const dateObj = state.selectedDate || new Date();
        document.getElementById('selectedDateLabel').textContent =
            dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        const events = state.events.filter(e => e.date === key);
        const container = document.getElementById('eventsList');
        if (events.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-day"></i><p>No events for this day</p></div>`;
            return;
        }
        container.innerHTML = events.map((e, idx) =>
            `<div class="event-item">
                <span>${e.title}</span>
                <div class="event-actions">
                    <button class="edit-btn" data-idx="${idx}" data-date="${key}"><i class="fas fa-pen"></i></button>
                    <button class="delete-btn" data-idx="${idx}" data-date="${key}"><i class="fas fa-trash"></i></button>
                </div>
            </div>`
        ).join('');

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const dateKey = btn.dataset.date;
                state.events = state.events.filter((_, i) => !(i === idx && state.events[i].date === dateKey));
                saveState();
                renderEvents();
                renderCalendar();
                showToast('Event deleted', 'info');
            });
        });

        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const dateKey = btn.dataset.date;
                const ev = state.events.find((e, i) => i === idx && e.date === dateKey);
                if (!ev) return;
                const newTitle = prompt('Edit event title:', ev.title);
                if (newTitle && newTitle.trim()) {
                    ev.title = newTitle.trim();
                    saveState();
                    renderEvents();
                    renderCalendar();
                    showToast('Event updated', 'success');
                }
            });
        });
    }

    // ------------------------------------------------------------
    //  TASKS
    // ------------------------------------------------------------
    function renderTasks() {
        const search = document.getElementById('taskSearch').value.toLowerCase();
        const filter = document.getElementById('taskFilter').value;
        const sort = document.getElementById('taskSort').value;

        let tasks = [...state.tasks];

        if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search));
        if (filter !== 'all') tasks = tasks.filter(t => t.priority === filter);

        if (sort === 'priority') {
            const order = { high: 0, medium: 1, low: 2 };
            tasks.sort((a, b) => order[a.priority] - order[b.priority]);
        } else if (sort === 'title') {
            tasks.sort((a, b) => a.title.localeCompare(b.title));
        } else {
            tasks.sort((a, b) => (a.created || 0) - (b.created || 0));
        }

        const container = document.getElementById('tasksList');
        if (tasks.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-tasks"></i><p>No tasks found. Add one!</p></div>`;
        } else {
            container.innerHTML = tasks.map((t, idx) => {
                const realIdx = state.tasks.indexOf(t);
                const doneClass = t.done ? 'done' : '';
                const titleClass = t.done ? 'done-text' : '';
                return `
                <div class="task-item" draggable="true" data-idx="${realIdx}">
                    <div class="task-check ${doneClass}" data-idx="${realIdx}">
                        ${t.done ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                    <div class="task-info">
                        <div class="task-title ${titleClass}">${t.title}</div>
                        <div class="task-meta">
                            <span>${t.category || 'Uncategorized'}</span>
                            ${t.due ? `<span>📅 ${t.due}</span>` : ''}
                            <span class="task-priority ${t.priority || 'medium'}">${t.priority || 'medium'}</span>
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="edit-btn" data-idx="${realIdx}"><i class="fas fa-pen"></i></button>
                        <button class="delete-btn" data-idx="${realIdx}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            }).join('');
        }

        container.querySelectorAll('.task-check').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.tasks[idx].done = !state.tasks[idx].done;
                saveState();
                renderTasks();
                updateTaskProgress();
                showToast(state.tasks[idx].done ? 'Task completed! 🎉' : 'Task uncompleted', 'info');
                updateStreak();
            });
        });

        container.querySelectorAll('.delete-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.tasks.splice(idx, 1);
                saveState();
                renderTasks();
                updateTaskProgress();
                showToast('Task deleted', 'info');
            });
        });

        container.querySelectorAll('.edit-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                openTaskModal(idx);
            });
        });

        let dragSrcIdx = null;
        container.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                dragSrcIdx = parseInt(item.dataset.idx);
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const targetIdx = parseInt(item.dataset.idx);
                if (dragSrcIdx !== null && dragSrcIdx !== targetIdx) {
                    const [moved] = state.tasks.splice(dragSrcIdx, 1);
                    state.tasks.splice(targetIdx, 0, moved);
                    saveState();
                    renderTasks();
                    showToast('Task reordered', 'info');
                }
                dragSrcIdx = null;
            });
        });

        updateTaskProgress();
    }

    function updateTaskProgress() {
        const total = state.tasks.length;
        const done = state.tasks.filter(t => t.done).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        document.getElementById('taskProgressFill').style.width = pct + '%';
        document.getElementById('taskProgressLabel').textContent = `${pct}% (${done}/${total})`;
    }

    function openTaskModal(editIdx = null) {
        const overlay = document.getElementById('taskModalOverlay');
        overlay.style.display = 'flex';
        const titleInput = document.getElementById('taskModalTitle');
        const prioritySelect = document.getElementById('taskModalPriority');
        const categoryInput = document.getElementById('taskModalCategory');
        const dueInput = document.getElementById('taskModalDue');
        const editIdInput = document.getElementById('taskModalEditId');

        if (editIdx !== null && state.tasks[editIdx]) {
            const t = state.tasks[editIdx];
            titleInput.value = t.title;
            prioritySelect.value = t.priority || 'medium';
            categoryInput.value = t.category || '';
            dueInput.value = t.due || '';
            editIdInput.value = editIdx;
        } else {
            titleInput.value = '';
            prioritySelect.value = 'medium';
            categoryInput.value = '';
            dueInput.value = '';
            editIdInput.value = '';
        }
        titleInput.focus();
    }

    function closeTaskModal() {
        document.getElementById('taskModalOverlay').style.display = 'none';
    }

    function saveTaskFromModal() {
        const title = document.getElementById('taskModalTitle').value.trim();
        if (!title) { showToast('Please enter a task title', 'error'); return; }
        const priority = document.getElementById('taskModalPriority').value;
        const category = document.getElementById('taskModalCategory').value.trim();
        const due = document.getElementById('taskModalDue').value;
        const editId = document.getElementById('taskModalEditId').value;

        if (editId !== '') {
            const idx = parseInt(editId);
            if (state.tasks[idx]) {
                state.tasks[idx].title = title;
                state.tasks[idx].priority = priority;
                state.tasks[idx].category = category;
                state.tasks[idx].due = due;
                showToast('Task updated', 'success');
            }
        } else {
            state.tasks.push({
                id: uid(),
                title,
                priority,
                category: category || 'Uncategorized',
                due: due || '',
                done: false,
                created: Date.now(),
            });
            showToast('Task added!', 'success');
        }
        saveState();
        closeTaskModal();
        renderTasks();
        updateStreak();
    }

    // ------------------------------------------------------------
    //  STREAK
    // ------------------------------------------------------------
    function updateStreak() {
        const completed = state.tasks.filter(t => t.done).length;
        state.streak = Math.min(completed, 365);
        saveState();
    }

    // ------------------------------------------------------------
    //  QUICK NOTES
    // ------------------------------------------------------------
    function renderNotes() {
        const grid = document.getElementById('notesGrid');
        const notes = [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        if (notes.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-sticky-note"></i><p>No notes yet. Write one!</p></div>`;
            return;
        }
        grid.innerHTML = notes.map((n, idx) => {
            const realIdx = state.notes.indexOf(n);
            return `
            <div class="note-card">
                <div class="note-title">
                    <span>${n.title || 'Untitled'}</span>
                    <button class="pin-btn ${n.pinned ? 'pinned' : ''}" data-idx="${realIdx}">
                        <i class="fas fa-thumbtack" style="transform:${n.pinned ? 'rotate(-45deg)' : 'rotate(0)'};"></i>
                    </button>
                </div>
                <div class="note-body">${n.body || ''}</div>
                <div class="note-actions">
                    <button class="edit-btn" data-idx="${realIdx}"><i class="fas fa-pen"></i> Edit</button>
                    <button class="delete-btn" data-idx="${realIdx}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        }).join('');

        grid.querySelectorAll('.delete-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.notes.splice(idx, 1);
                saveState();
                renderNotes();
                showToast('Note deleted', 'info');
            });
        });

        grid.querySelectorAll('.pin-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.notes[idx].pinned = !state.notes[idx].pinned;
                saveState();
                renderNotes();
            });
        });

        grid.querySelectorAll('.edit-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                const n = state.notes[idx];
                const newTitle = prompt('Edit note title:', n.title);
                if (newTitle !== null) {
                    const newBody = prompt('Edit note content:', n.body);
                    if (newBody !== null) {
                        n.title = newTitle.trim() || 'Untitled';
                        n.body = newBody;
                        saveState();
                        renderNotes();
                        showToast('Note updated', 'success');
                    }
                }
            });
        });
    }

    // ------------------------------------------------------------
    //  STICKY NOTES
    // ------------------------------------------------------------
    function renderStickies() {
        const container = document.getElementById('stickyContainer');
        const colors = ['#f9e8b0', '#f9d8b0', '#f9c8b0', '#d4e8b0', '#b0d8e8', '#e8b0d8', '#f0b0b0', '#b0e8c8'];
        if (state.stickies.length === 0) {
            container.innerHTML = `<div class="empty-state" style="width:100%;"><i class="fas fa-thumbtack"></i><p>No sticky notes. Add one!</p></div>`;
            return;
        }
        container.innerHTML = state.stickies.map((s, idx) => {
            const realIdx = state.stickies.indexOf(s);
            const color = s.color || colors[realIdx % colors.length];
            return `
            <div class="sticky-note" style="background:${color};" data-idx="${realIdx}">
                <textarea class="sticky-text" placeholder="Write something..." data-idx="${realIdx}">${s.text || ''}</textarea>
                <div class="sticky-actions">
                    <button class="delete-btn" data-idx="${realIdx}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        }).join('');

        container.querySelectorAll('.sticky-text').forEach(el => {
            el.addEventListener('input', () => {
                const idx = parseInt(el.dataset.idx);
                if (state.stickies[idx]) {
                    state.stickies[idx].text = el.value;
                    saveState();
                }
            });
        });

        container.querySelectorAll('.delete-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.stickies.splice(idx, 1);
                saveState();
                renderStickies();
                showToast('Sticky deleted', 'info');
            });
        });

        let dragEl = null;
        let offsetX, offsetY;
        container.querySelectorAll('.sticky-note').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                dragEl = el;
                const rect = el.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                el.style.cursor = 'grabbing';
                el.style.position = 'relative';
                el.style.zIndex = '10';
            });
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragEl) return;
            const containerRect = container.getBoundingClientRect();
            let x = e.clientX - containerRect.left - offsetX;
            let y = e.clientY - containerRect.top - offsetY;
            x = Math.max(0, Math.min(x, containerRect.width - dragEl.offsetWidth));
            y = Math.max(0, Math.min(y, containerRect.height - dragEl.offsetHeight));
            dragEl.style.transform = `translate(${x}px, ${y}px)`;
        });
        document.addEventListener('mouseup', () => {
            if (dragEl) {
                dragEl.style.cursor = 'grab';
                dragEl.style.zIndex = '1';
                const idx = parseInt(dragEl.dataset.idx);
                if (state.stickies[idx]) {
                    state.stickies[idx].position = dragEl.style.transform;
                    saveState();
                }
                dragEl = null;
            }
        });
    }

    // ------------------------------------------------------------
    //  ASSIGNMENTS
    // ------------------------------------------------------------
    function renderAssignments() {
        const container = document.getElementById('assignmentsList');
        if (state.assignments.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-file-alt"></i><p>No assignments. Add one!</p></div>`;
            return;
        }
        container.innerHTML = state.assignments.map((a, idx) => {
            const realIdx = state.assignments.indexOf(a);
            const pct = Math.min(100, Math.max(0, parseInt(a.progress) || 0));
            const statusColor = a.status === 'completed' ? 'var(--success)' : a.status === 'in-progress' ? 'var(--accent)' : 'var(--error)';
            return `
            <div class="assignment-item">
                <div class="assign-info">
                    <div class="title">${a.title}</div>
                    <div class="meta">
                        <span>📚 ${a.subject || 'General'}</span>
                        <span>📅 ${a.deadline || 'No deadline'}</span>
                        <span style="color:${statusColor};font-weight:600;">${a.status || 'pending'}</span>
                    </div>
                </div>
                <div class="assign-progress">
                    <div class="label">${pct}%</div>
                    <div class="bar"><div class="fill" style="width:${pct}%;"></div></div>
                </div>
                <div class="assign-actions">
                    <button class="edit-btn" data-idx="${realIdx}"><i class="fas fa-pen"></i></button>
                    <button class="delete-btn" data-idx="${realIdx}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        }).join('');

        container.querySelectorAll('.delete-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.assignments.splice(idx, 1);
                saveState();
                renderAssignments();
                showToast('Assignment deleted', 'info');
            });
        });

        container.querySelectorAll('.edit-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                const a = state.assignments[idx];
                const newTitle = prompt('Assignment title:', a.title);
                if (newTitle !== null && newTitle.trim()) {
                    a.title = newTitle.trim();
                    const newSubject = prompt('Subject:', a.subject || '');
                    if (newSubject !== null) a.subject = newSubject.trim();
                    const newDeadline = prompt('Deadline (YYYY-MM-DD):', a.deadline || '');
                    if (newDeadline !== null) a.deadline = newDeadline.trim();
                    const newStatus = prompt('Status (pending/in-progress/completed):', a.status || 'pending');
                    if (newStatus !== null) a.status = newStatus.trim().toLowerCase();
                    const newProgress = prompt('Progress (0-100):', a.progress || '0');
                    if (newProgress !== null) a.progress = Math.min(100, Math.max(0, parseInt(newProgress) || 0));
                    saveState();
                    renderAssignments();
                    showToast('Assignment updated', 'success');
                }
            });
        });
    }

    // ------------------------------------------------------------
    //  CGPA
    // ------------------------------------------------------------
    function renderCGPA() {
        const tbody = document.getElementById('cgpaTableBody');
        if (state.cgpaCourses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);font-size:0.85rem;">No courses added</td></tr>`;
        } else {
            tbody.innerHTML = state.cgpaCourses.map((c, idx) => {
                const points = (c.grade || 0) * (c.credits || 0);
                return `
                <tr>
                    <td>${c.subject || 'Course'}</td>
                    <td>${c.grade || 0}</td>
                    <td>${c.credits || 0}</td>
                    <td>${points.toFixed(1)}</td>
                    <td><span class="delete-row" data-idx="${idx}"><i class="fas fa-times"></i></span></td>
                </tr>
            `;
            }).join('');
        }

        tbody.querySelectorAll('.delete-row').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.cgpaCourses.splice(idx, 1);
                saveState();
                renderCGPA();
                showToast('Course removed', 'info');
            });
        });

        let totalPoints = 0, totalCredits = 0;
        state.cgpaCourses.forEach(c => {
            totalPoints += (c.grade || 0) * (c.credits || 0);
            totalCredits += (c.credits || 0);
        });
        const semGPA = totalCredits > 0 ? totalPoints / totalCredits : 0;
        document.getElementById('cgpaSemester').textContent = semGPA.toFixed(2);
        document.getElementById('cgpaOverall').textContent = semGPA.toFixed(2);
        document.getElementById('cgpaCreditsTotal').textContent = totalCredits;
    }

    // ------------------------------------------------------------
    //  FILE MANAGER
    // ------------------------------------------------------------
    function renderFiles() {
        const search = document.getElementById('fileSearch').value.toLowerCase();
        let files = [...state.files];
        if (search) files = files.filter(f => f.name.toLowerCase().includes(search));

        const grid = document.getElementById('filesGrid');
        if (files.length === 0) {
            grid.innerHTML = `
                <div class="file-empty">
                    <i class="fas fa-folder-open"></i>
                    <p>${search ? 'No files match your search' : 'No files uploaded yet. Upload a PDF, image, or text file!'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = files.map((f, idx) => {
            const realIdx = state.files.indexOf(f);
            const icon = getFileIcon(f.type);
            return `
                <div class="file-item">
                    <i class="fas ${icon} file-icon"></i>
                    <div class="file-name" title="${f.name}">${f.name}</div>
                    <div class="file-size">${formatFileSize(f.size)}</div>
                    <div class="file-actions">
                        <button class="download-btn" data-idx="${realIdx}"><i class="fas fa-download"></i></button>
                        <button class="delete-btn" data-idx="${realIdx}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.download-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                const f = state.files[idx];
                if (!f) return;
                try {
                    const byteCharacters = atob(f.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: f.type });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = f.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast(`Downloading ${f.name}`, 'success');
                } catch (e) {
                    showToast('Error downloading file', 'error');
                }
            });
        });

        grid.querySelectorAll('.delete-btn').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                state.files.splice(idx, 1);
                saveState();
                renderFiles();
                showToast('File deleted', 'info');
            });
        });
    }

    function handleFileUpload(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showToast(`File "${file.name}" is too large (max 5MB)`, 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result.split(',')[1];
            state.files.push({
                id: uid(),
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                data: base64,
                uploaded: Date.now(),
            });
            saveState();
            renderFiles();
            showToast(`Uploaded "${file.name}"`, 'success');
        };
        reader.onerror = function() {
            showToast(`Error reading file "${file.name}"`, 'error');
        };
        reader.readAsDataURL(file);
    }

    // ------------------------------------------------------------
    //  POMODORO
    // ------------------------------------------------------------
    function pomodoroSetMode(mode) {
        state.pomodoroMode = mode;
        $$('#pomodoroModes button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        let minutes = 25, breakMin = 5;
        if (mode === '50') { minutes = 50; breakMin = 10; } else if (mode === 'custom') {
            const m = prompt('Enter focus minutes:', '25');
            if (m && !isNaN(m)) minutes = parseInt(m);
            const b = prompt('Enter break minutes:', '5');
            if (b && !isNaN(b)) breakMin = parseInt(b);
        }
        state.pomodoroTime = minutes * 60;
        state.pomodoroMax = minutes * 60;
        state.pomodoroPhase = 'focus';
        state.pomodoroBreak = breakMin * 60;
        updatePomodoroDisplay();
        document.getElementById('pomodoroLabel').textContent = 'Focus';
    }

    function updatePomodoroDisplay() {
        const min = Math.floor(state.pomodoroTime / 60);
        const sec = Math.floor(state.pomodoroTime % 60);
        document.getElementById('pomodoroMinutes').textContent =
            `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        const circle = document.getElementById('pomodoroCircle');
        const max = state.pomodoroMax || 25 * 60;
        const circumference = 490.088;
        const offset = circumference * (1 - state.pomodoroTime / max);
        circle.style.strokeDashoffset = Math.max(0, Math.min(circumference, offset));
    }

    function pomodoroTick() {
        if (state.pomodoroTime <= 0) {
            if (state.pomodoroPhase === 'focus') {
                state.pomodoro.sessions = (state.pomodoro.sessions || 0) + 1;
                state.pomodoro.totalMin = (state.pomodoro.totalMin || 0) + Math.floor(state.pomodoroMax / 60);
                state.pomodoro.streak = (state.pomodoro.streak || 0) + 1;
                showToast('🎉 Focus session complete!', 'success');
                sendBrowserNotification('Pomodoro Complete', 'Great focus! Take a break.');
                state.pomodoroPhase = 'break';
                state.pomodoroTime = state.pomodoroBreak || 5 * 60;
                state.pomodoroMax = state.pomodoroTime;
                document.getElementById('pomodoroLabel').textContent = 'Break';
            } else {
                state.pomodoroPhase = 'focus';
                state.pomodoroTime = state.pomodoroMax;
                document.getElementById('pomodoroLabel').textContent = 'Focus';
                showToast('Break over! Back to focus.', 'info');
                sendBrowserNotification('Break Over', 'Time to focus again!');
            }
            saveState();
            updatePomodoroDisplay();
            document.getElementById('pomodoroSessions').textContent = state.pomodoro.sessions || 0;
            document.getElementById('pomodoroTotalMin').textContent = state.pomodoro.totalMin || 0;
            document.getElementById('pomodoroStreak').textContent = state.pomodoro.streak || 0;
            return;
        }
        state.pomodoroTime--;
        updatePomodoroDisplay();
    }

    // ------------------------------------------------------------
    //  STOPWATCH
    // ------------------------------------------------------------
    function stopwatchTick() {
        state.stopwatchTime += 10;
        document.getElementById('stopwatchDisplay').textContent = formatStopwatch(state.stopwatchTime);
    }

    // ------------------------------------------------------------
    //  COUNTDOWN
    // ------------------------------------------------------------
    function countdownTick() {
        if (state.countdownTime <= 0) {
            clearInterval(state.countdownInterval);
            state.countdownRunning = false;
            document.getElementById('countdownStart').innerHTML = '<i class="fas fa-play"></i> Start';
            showToast('⏰ Countdown finished!', 'warning');
            sendBrowserNotification('Countdown', 'Your countdown has finished!');
            try {
                const ctx = new(window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 800;
                gain.gain.value = 0.25;
                osc.start();
                setTimeout(() => { osc.stop(); }, 350);
            } catch (e) { /* ignore */ }
            return;
        }
        state.countdownTime--;
        const m = Math.floor(state.countdownTime / 60);
        const s = Math.floor(state.countdownTime % 60);
        document.getElementById('countdownDisplay').textContent =
            `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    // ------------------------------------------------------------
    //  LIVE CLOCK
    // ------------------------------------------------------------
    function updateClock() {
        const now = new Date();
        document.getElementById('liveClock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }

    // ------------------------------------------------------------
    //  SETTINGS
    // ------------------------------------------------------------
    function renderSettings() {}

    // ------------------------------------------------------------
    //  RESET & IMPORT/EXPORT
    // ------------------------------------------------------------
    function resetAllData() {
        if (!confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone!')) return;
        state.tasks = [];
        state.notes = [];
        state.stickies = [];
        state.assignments = [];
        state.cgpaCourses = [];
        state.events = [];
        state.files = [];
        state.pomodoro = { sessions: 0, totalMin: 0, streak: 0 };
        state.streak = 0;
        saveState();
        navigateTo('dashboard');
        showToast('All data has been reset', 'error');
    }

    function exportData() {
        const data = localStorage.getItem('studentos_data');
        if (!data) { showToast('No data to export', 'warning'); return; }
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studentos_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully', 'success');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.tasks || !data.notes) { throw new Error('Invalid format'); }
                localStorage.setItem('studentos_data', JSON.stringify(data));
                loadState();
                navigateTo('dashboard');
                showToast('Data imported successfully!', 'success');
            } catch (err) {
                showToast('Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ------------------------------------------------------------
    //  INIT
    // ------------------------------------------------------------
    function init() {
        loadState();

        applyTheme(state.settings.theme || 'light');
        applyAccent(state.settings.accent || '#52796F');
        applyFontSize(state.settings.fontSize || 'medium');

        state.selectedDate = getToday();
        state.calendarYear = state.selectedDate.getFullYear();
        state.calendarMonth = state.selectedDate.getMonth();

        updateClock();
        setInterval(updateClock, 1000);

        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) navigateTo(page);
            });
        });

        document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
        document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);

        const backBtn = document.getElementById('backTopBtn');
        window.addEventListener('scroll', () => {
            backBtn.classList.toggle('visible', window.scrollY > 350);
        });
        backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

        // --- CALENDAR ---
        document.getElementById('calPrev').addEventListener('click', () => {
            state.calendarMonth--;
            if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
            renderCalendar();
        });
        document.getElementById('calNext').addEventListener('click', () => {
            state.calendarMonth++;
            if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
            renderCalendar();
        });
        document.getElementById('calToday').addEventListener('click', () => {
            const now = new Date();
            state.calendarYear = now.getFullYear();
            state.calendarMonth = now.getMonth();
            state.selectedDate = getToday();
            renderCalendar();
        });

        document.getElementById('addEventBtn').addEventListener('click', () => {
            const input = document.getElementById('eventInput');
            const title = input.value.trim();
            if (!title) { showToast('Please enter an event title', 'error'); return; }
            const key = state.selectedDate ? getDateKey(state.selectedDate) : getDateKey(new Date());
            state.events.push({ date: key, title });
            saveState();
            input.value = '';
            renderEvents();
            renderCalendar();
            showToast('Event added!', 'success');
        });
        document.getElementById('eventInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('addEventBtn').click();
        });

        // --- TASKS ---
        document.getElementById('openTaskModal').addEventListener('click', () => openTaskModal(null));
        document.getElementById('taskModalCancel').addEventListener('click', closeTaskModal);
        document.getElementById('taskModalSave').addEventListener('click', saveTaskFromModal);
        document.getElementById('taskModalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeTaskModal();
        });
        document.getElementById('taskSearch').addEventListener('input', renderTasks);
        document.getElementById('taskFilter').addEventListener('change', renderTasks);
        document.getElementById('taskSort').addEventListener('change', renderTasks);

        // --- NOTES ---
        document.getElementById('addNoteBtn').addEventListener('click', () => {
            const title = document.getElementById('noteTitleInput').value.trim() || 'Untitled';
            const body = document.getElementById('noteBodyInput').value.trim();
            if (!body) { showToast('Please write some content', 'error'); return; }
            state.notes.push({ id: uid(), title, body, pinned: false });
            saveState();
            document.getElementById('noteTitleInput').value = '';
            document.getElementById('noteBodyInput').value = '';
            renderNotes();
            showToast('Note added!', 'success');
        });

        // --- STICKY ---
        document.getElementById('addStickyBtn').addEventListener('click', () => {
            const colors = ['#f9e8b0', '#f9d8b0', '#f9c8b0', '#d4e8b0', '#b0d8e8', '#e8b0d8', '#f0b0b0', '#b0e8c8'];
            state.stickies.push({
                id: uid(),
                text: 'New sticky note...',
                color: colors[state.stickies.length % colors.length],
                position: ''
            });
            saveState();
            renderStickies();
            showToast('Sticky note added!', 'success');
        });

        // --- ASSIGNMENTS ---
        document.getElementById('addAssignBtn').addEventListener('click', () => {
            const title = document.getElementById('assignTitle').value.trim();
            if (!title) { showToast('Please enter an assignment title', 'error'); return; }
            const subject = document.getElementById('assignSubject').value.trim();
            const deadline = document.getElementById('assignDeadline').value;
            const status = document.getElementById('assignStatus').value;
            const progress = parseInt(document.getElementById('assignProgress').value) || 0;
            state.assignments.push({
                id: uid(),
                title,
                subject: subject || 'General',
                deadline,
                status,
                progress: Math.min(100, Math.max(0, progress)),
            });
            saveState();
            document.getElementById('assignTitle').value = '';
            document.getElementById('assignSubject').value = '';
            document.getElementById('assignDeadline').value = '';
            document.getElementById('assignProgress').value = '0';
            renderAssignments();
            showToast('Assignment added!', 'success');
        });

        // --- CGPA ---
        document.getElementById('cgpaAddBtn').addEventListener('click', () => {
            const subject = document.getElementById('cgpaSubject').value.trim() || 'Course';
            const grade = parseFloat(document.getElementById('cgpaGrade').value);
            const credits = parseFloat(document.getElementById('cgpaCredits').value);
            if (isNaN(grade) || isNaN(credits) || grade < 0 || grade > 4 || credits <= 0) {
                showToast('Please enter valid grade (0-4) and credits', 'error');
                return;
            }
            state.cgpaCourses.push({ subject, grade, credits });
            saveState();
            document.getElementById('cgpaSubject').value = '';
            document.getElementById('cgpaGrade').value = '';
            document.getElementById('cgpaCredits').value = '';
            renderCGPA();
            showToast('Course added!', 'success');
        });

        // --- FILE MANAGER ---
        document.getElementById('fileUploadInput').addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length === 0) return;
            for (let f of files) {
                handleFileUpload(f);
            }
            e.target.value = '';
        });
        document.getElementById('fileSearch').addEventListener('input', renderFiles);

        // --- POMODORO ---
        document.querySelectorAll('#pomodoroModes button').forEach(btn => {
            btn.addEventListener('click', () => {
                clearInterval(state.pomodoroInterval);
                state.pomodoroRunning = false;
                document.getElementById('pomodoroStart').innerHTML = '<i class="fas fa-play"></i> Start';
                pomodoroSetMode(btn.dataset.mode);
            });
        });
        document.getElementById('pomodoroStart').addEventListener('click', () => {
            if (state.pomodoroRunning) {
                clearInterval(state.pomodoroInterval);
                state.pomodoroRunning = false;
                document.getElementById('pomodoroStart').innerHTML = '<i class="fas fa-play"></i> Start';
                showToast('Paused', 'info');
                return;
            }
            state.pomodoroRunning = true;
            document.getElementById('pomodoroStart').innerHTML = '<i class="fas fa-pause"></i> Pause';
            state.pomodoroInterval = setInterval(pomodoroTick, 1000);
        });
        document.getElementById('pomodoroPause').addEventListener('click', () => {
            if (state.pomodoroRunning) {
                clearInterval(state.pomodoroInterval);
                state.pomodoroRunning = false;
                document.getElementById('pomodoroStart').innerHTML = '<i class="fas fa-play"></i> Start';
                showToast('Paused', 'info');
            }
        });
        document.getElementById('pomodoroReset').addEventListener('click', () => {
            clearInterval(state.pomodoroInterval);
            state.pomodoroRunning = false;
            document.getElementById('pomodoroStart').innerHTML = '<i class="fas fa-play"></i> Start';
            pomodoroSetMode(state.pomodoroMode || '25');
        });

        // --- STOPWATCH ---
        document.getElementById('stopwatchStart').addEventListener('click', () => {
            if (state.stopwatchRunning) {
                clearInterval(state.stopwatchInterval);
                state.stopwatchRunning = false;
                document.getElementById('stopwatchStart').innerHTML = '<i class="fas fa-play"></i> Start';
                showToast('Paused', 'info');
                return;
            }
            state.stopwatchRunning = true;
            document.getElementById('stopwatchStart').innerHTML = '<i class="fas fa-pause"></i> Pause';
            state.stopwatchInterval = setInterval(stopwatchTick, 10);
        });
        document.getElementById('stopwatchPause').addEventListener('click', () => {
            if (state.stopwatchRunning) {
                clearInterval(state.stopwatchInterval);
                state.stopwatchRunning = false;
                document.getElementById('stopwatchStart').innerHTML = '<i class="fas fa-play"></i> Start';
                showToast('Paused', 'info');
            }
        });
        document.getElementById('stopwatchReset').addEventListener('click', () => {
            clearInterval(state.stopwatchInterval);
            state.stopwatchRunning = false;
            state.stopwatchTime = 0;
            state.stopwatchLaps = [];
            document.getElementById('stopwatchDisplay').textContent = '00:00:00.00';
            document.getElementById('stopwatchStart').innerHTML = '<i class="fas fa-play"></i> Start';
            document.getElementById('lapList').innerHTML = '';
        });
        document.getElementById('stopwatchLap').addEventListener('click', () => {
            if (!state.stopwatchRunning) { showToast('Start the stopwatch first', 'warning'); return; }
            const time = formatStopwatch(state.stopwatchTime);
            state.stopwatchLaps.push(time);
            const list = document.getElementById('lapList');
            list.innerHTML = state.stopwatchLaps.map((l, i) =>
                `<div class="lap-item"><span>Lap ${i+1}</span><span>${l}</span></div>`
            ).join('');
        });

        // --- COUNTDOWN ---
        function updateCountdownDisplay() {
            const m = Math.floor(state.countdownTime / 60);
            const s = Math.floor(state.countdownTime % 60);
            document.getElementById('countdownDisplay').textContent =
                `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }

        document.getElementById('countdownStart').addEventListener('click', () => {
            if (state.countdownRunning) {
                clearInterval(state.countdownInterval);
                state.countdownRunning = false;
                document.getElementById('countdownStart').innerHTML = '<i class="fas fa-play"></i> Start';
                showToast('Paused', 'info');
                return;
            }
            if (state.countdownTime <= 0) {
                const h = parseInt(document.getElementById('cdHours').value) || 0;
                const m = parseInt(document.getElementById('cdMinutes').value) || 0;
                const s = parseInt(document.getElementById('cdSeconds').value) || 0;
                state.countdownTime = h * 3600 + m * 60 + s;
                state.countdownMax = state.countdownTime;
                if (state.countdownTime <= 0) { showToast('Please set a valid time', 'error'); return; }
                updateCountdownDisplay();
            }
            state.countdownRunning = true;
            document.getElementById('countdownStart').innerHTML = '<i class="fas fa-pause"></i> Pause';
            state.countdownInterval = setInterval(countdownTick, 1000);
        });
        document.getElementById('countdownPause').addEventListener('click', () => {
            if (state.countdownRunning) {
                clearInterval(state.countdownInterval);
                state.countdownRunning = false;
                document.getElementById('countdownStart').innerHTML = '<i class="fas fa-play"></i> Start';
                showToast('Paused', 'info');
            }
        });
        document.getElementById('countdownReset').addEventListener('click', () => {
            clearInterval(state.countdownInterval);
            state.countdownRunning = false;
            state.countdownTime = 0;
            document.getElementById('countdownStart').innerHTML = '<i class="fas fa-play"></i> Start';
            updateCountdownDisplay();
            document.getElementById('cdHours').value = 0;
            document.getElementById('cdMinutes').value = 5;
            document.getElementById('cdSeconds').value = 0;
        });
        ['cdHours', 'cdMinutes', 'cdSeconds'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                if (!state.countdownRunning && state.countdownTime <= 0) {
                    const h = parseInt(document.getElementById('cdHours').value) || 0;
                    const m = parseInt(document.getElementById('cdMinutes').value) || 0;
                    const s = parseInt(document.getElementById('cdSeconds').value) || 0;
                    state.countdownTime = h * 3600 + m * 60 + s;
                    state.countdownMax = state.countdownTime;
                    updateCountdownDisplay();
                }
            });
        });

        // --- SETTINGS ---
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
        document.getElementById('accentColorPicker').addEventListener('input', (e) => {
            applyAccent(e.target.value);
        });
        document.getElementById('fontSizeSelect').addEventListener('change', (e) => {
            applyFontSize(e.target.value);
        });
        document.getElementById('exportDataBtn').addEventListener('click', exportData);
        document.getElementById('importDataInput').addEventListener('change', (e) => {
            if (e.target.files[0]) importData(e.target.files[0]);
            e.target.value = '';
        });
        document.getElementById('resetAllBtn').addEventListener('click', resetAllData);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const search = document.getElementById('taskSearch');
                if (search) search.focus();
            }
            if (e.key === 'Escape') {
                closeTaskModal();
                closeSidebar();
            }
        });

        navigateTo('dashboard');

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        console.log('🚀 StudentOS initialized');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();