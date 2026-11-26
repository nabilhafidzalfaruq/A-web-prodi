// ===== Reminder Giok - PWA (Perpaduan Hijau Giok) =====
// Data tersimpan lokal di browser (HP & Laptop) + fitur transfer/backup JSON

(function () {
    'use strict';

    // ===== DOM Helpers =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // Header & Controls
    const headerGreeting = $('#headerGreeting');
    const currentDateEl = $('#currentDate');
    const liveClockEl = $('#liveClock');
    const notifStatusBtn = $('#notifStatusBtn');
    const notifStatusText = $('#notifStatusText');
    const btnSoundToggle = $('#btnSoundToggle');
    const soundIconOn = $('#soundIconOn');
    const soundIconOff = $('#soundIconOff');
    const btnBackup = $('#btnBackup');
    const btnAdd = $('#btnAdd');

    // Stats & Tabs & Search
    const statTotal = $('#statTotal');
    const statActive = $('#statActive');
    const statDone = $('#statDone');
    const countAll = $('#countAll');
    const countActive = $('#countActive');
    const countToday = $('#countToday');
    const countDone = $('#countDone');
    const searchInput = $('#searchInput');
    const btnClearSearch = $('#btnClearSearch');

    // List & Empty State
    const reminderList = $('#reminderList');
    const emptyState = $('#emptyState');
    const emptyTitle = $('#emptyTitle');
    const emptyDesc = $('#emptyDesc');

    // Add/Edit Modal
    const modalOverlay = $('#modalOverlay');
    const modalTitle = $('#modalTitle');
    const btnCloseModal = $('#btnCloseModal');
    const btnCancel = $('#btnCancel');
    const reminderForm = $('#reminderForm');
    const inputTitle = $('#inputTitle');
    const inputDesc = $('#inputDesc');
    const inputDate = $('#inputDate');
    const inputHour = $('#inputHour');
    const inputMinute = $('#inputMinute');
    const btnAm = $('#btnAm');
    const btnPm = $('#btnPm');
    const inputRepeat = $('#inputRepeat');
    const editIdInput = $('#editId');
    const btnSubmitText = $('#btnSubmitText');

    // Alarm Modal
    const alarmOverlay = $('#alarmOverlay');
    const alarmTitle = $('#alarmTitle');
    const alarmDesc = $('#alarmDesc');
    const alarmTimeLabel = $('#alarmTimeLabel');
    const btnAlarmSnooze = $('#btnAlarmSnooze');
    const btnAlarmDone = $('#btnAlarmDone');
    const btnAlarmClose = $('#btnAlarmClose');

    // Sync / Backup Modal
    const syncOverlay = $('#syncOverlay');
    const btnCloseSync = $('#btnCloseSync');
    const btnCopyBackup = $('#btnCopyBackup');
    const btnExportJson = $('#btnExportJson');
    const importTextarea = $('#importTextarea');
    const importFileInput = $('#importFileInput');
    const btnImportMerge = $('#btnImportMerge');
    const btnImportReplace = $('#btnImportReplace');

    // Notification Banner & Toast
    const notifBanner = $('#notifBanner');
    const btnEnableNotif = $('#btnEnableNotif');
    const btnDismissNotif = $('#btnDismissNotif');
    const toast = $('#toast');
    const toastMessage = $('#toastMessage');

    // ===== State =====
    let reminders = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let notifiedIds = new Set();
    let soundEnabled = true;
    let swRegistration = null;
    let activeAlarmId = null;
    let toastTimer = null;
    let audioCtx = null;
    let selectedPeriod = 'AM';

    // ===== Storage Keys =====
    const STORAGE_KEY = 'reminder_app_data';
    const NOTIFIED_KEY = 'reminder_notified_ids';
    const SOUND_KEY = 'reminder_sound_enabled';
    const CHECK_INTERVAL = 15000;

    // ===== Init =====
    function init() {
        populateTimeSelectors();
        loadReminders();
        loadNotifiedIds();
        loadSoundSetting();
        updateHeaderClock();
        renderAll();
        setupEventListeners();
        registerServiceWorker();
        updateNotificationUI();
        startTimers();
    }

    // ===== Storage =====
    function loadReminders() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            reminders = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(reminders)) reminders = [];
        } catch (e) {
            reminders = [];
        }
    }

    function saveReminders() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    }

    function loadNotifiedIds() {
        try {
            const raw = localStorage.getItem(NOTIFIED_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            notifiedIds = new Set(Array.isArray(arr) ? arr : []);
        } catch (e) {
            notifiedIds = new Set();
        }
    }

    function saveNotifiedIds() {
        const validIds = new Set(reminders.map((r) => r.id));
        const pruned = [...notifiedIds].filter((id) => validIds.has(id));
        notifiedIds = new Set(pruned);
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
    }

    function loadSoundSetting() {
        try {
            const saved = localStorage.getItem(SOUND_KEY);
            soundEnabled = saved === null ? true : saved === 'true';
        } catch (e) {
            soundEnabled = true;
        }
        updateSoundUI();
    }

    function updateSoundUI() {
        if (soundEnabled) {
            soundIconOn.style.display = 'block';
            soundIconOff.style.display = 'none';
            btnSoundToggle.classList.remove('muted');
            btnSoundToggle.title = 'Suara Alarm: Aktif';
        } else {
            soundIconOn.style.display = 'none';
            soundIconOff.style.display = 'block';
            btnSoundToggle.classList.add('muted');
            btnSoundToggle.title = 'Suara Alarm: Nonaktif';
        }
    }

    // ===== Local Date & Time Helpers (Timezone-Safe) =====
    const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    function toLocalDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function toLocalTimeStr(d) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function to12HourParts(time24Str) {
        const parts = (time24Str || '09:00').split(':').map(Number);
        const h24 = isNaN(parts[0]) ? 9 : Math.max(0, Math.min(23, parts[0]));
        const min = isNaN(parts[1]) ? 0 : Math.max(0, Math.min(59, parts[1]));
        const period = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return {
            hour: String(h12).padStart(2, '0'),
            minute: String(min).padStart(2, '0'),
            period
        };
    }

    function to24HourTime(hour12, minute, period) {
        let h = parseInt(hour12, 10);
        if (isNaN(h)) h = 12;
        if (period === 'AM') {
            if (h === 12) h = 0;
        } else {
            if (h !== 12) h += 12;
        }
        const m = String(parseInt(minute, 10) || 0).padStart(2, '0');
        return `${String(h).padStart(2, '0')}:${m}`;
    }

    function formatTime12h(time24Str) {
        const { hour, minute, period } = to12HourParts(time24Str);
        return `${hour}:${minute} ${period}`;
    }

    function populateTimeSelectors() {
        let hourHtml = '';
        for (let i = 1; i <= 12; i++) {
            const val = String(i).padStart(2, '0');
            hourHtml += `<option value="${val}">${val}</option>`;
        }
        inputHour.innerHTML = hourHtml;

        let minHtml = '';
        for (let i = 0; i < 60; i++) {
            const val = String(i).padStart(2, '0');
            minHtml += `<option value="${val}">${val}</option>`;
        }
        inputMinute.innerHTML = minHtml;
    }

    function setPeriod(period) {
        selectedPeriod = period === 'PM' ? 'PM' : 'AM';
        btnAm.classList.toggle('active', selectedPeriod === 'AM');
        btnPm.classList.toggle('active', selectedPeriod === 'PM');
        btnAm.setAttribute('aria-pressed', String(selectedPeriod === 'AM'));
        btnPm.setAttribute('aria-pressed', String(selectedPeriod === 'PM'));
    }

    function setTimePickerValue(time24Str) {
        const { hour, minute, period } = to12HourParts(time24Str);
        inputHour.value = hour;
        inputMinute.value = minute;
        setPeriod(period);
    }

    function getTimePickerValue() {
        return to24HourTime(inputHour.value, inputMinute.value, selectedPeriod);
    }

    function parseLocalDate(dateStr) {
        const parts = (dateStr || '').split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return new Date();
        return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }

    function getDateTimeStamp(dateStr, timeStr) {
        const dParts = (dateStr || '').split('-').map(Number);
        const tParts = (timeStr || '00:00').split(':').map(Number);
        if (dParts.length !== 3 || tParts.length < 2) return Date.now();
        return new Date(dParts[0], dParts[1] - 1, dParts[2], tParts[0], tParts[1], 0, 0).getTime();
    }

    function updateHeaderClock() {
        const now = new Date();
        const h = now.getHours();
        if (h >= 5 && h < 11) headerGreeting.textContent = 'Selamat Pagi';
        else if (h >= 11 && h < 15) headerGreeting.textContent = 'Selamat Siang';
        else if (h >= 15 && h < 18) headerGreeting.textContent = 'Selamat Sore';
        else headerGreeting.textContent = 'Selamat Malam';

        currentDateEl.textContent = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
        liveClockEl.textContent = formatTime12h(toLocalTimeStr(now));
    }

    function formatDateLabel(dateStr) {
        const target = parseLocalDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (target.getTime() === today.getTime()) return 'Hari Ini';
        if (target.getTime() === tomorrow.getTime()) return 'Besok';
        return `${target.getDate()} ${MONTHS[target.getMonth()].slice(0, 3)} ${target.getFullYear()}`;
    }

    function isToday(dateStr) {
        return dateStr === toLocalDateStr(new Date());
    }

    function isOverdue(dateStr, timeStr, done) {
        if (done) return false;
        return getDateTimeStamp(dateStr, timeStr) < Date.now();
    }

    function getCountdownInfo(dateStr, timeStr, done) {
        if (done) return null;
        const targetTs = getDateTimeStamp(dateStr, timeStr);
        const diffMs = targetTs - Date.now();
        const diffMin = Math.round(diffMs / 60000);

        if (diffMin < -1440) {
            const days = Math.floor(Math.abs(diffMin) / 1440);
            return { text: `Terlewat ${days} hari`, cls: 'overdue' };
        }
        if (diffMin < -60) {
            const hrs = Math.floor(Math.abs(diffMin) / 60);
            return { text: `Terlewat ${hrs} jam`, cls: 'overdue' };
        }
        if (diffMin < 0) {
            return { text: `Terlewat ${Math.abs(diffMin)} mnt`, cls: 'overdue' };
        }
        if (diffMin === 0) {
            return { text: 'Sekarang!', cls: 'soon' };
        }
        if (diffMin < 60) {
            return { text: `Dalam ${diffMin} mnt`, cls: diffMin <= 15 ? 'soon' : '' };
        }
        if (diffMin < 1440) {
            const hrs = Math.floor(diffMin / 60);
            const mins = diffMin % 60;
            return {
                text: mins > 0 ? `${hrs}j ${mins}m lagi` : `${hrs} jam lagi`,
                cls: ''
            };
        }
        const days = Math.ceil(diffMin / 1440);
        return { text: `${days} hari lagi`, cls: '' };
    }

    function getRepeatLabel(repeat) {
        const labels = {
            daily: 'Harian',
            weekly: 'Mingguan',
            monthly: 'Bulanan'
        };
        return labels[repeat] || null;
    }

    function getDateGroupInfo(dateStr, timeStr) {
        if (isOverdue(dateStr, timeStr, false)) {
            return { key: 'overdue', label: 'Perlu Perhatian (Terlewat)', isOverdue: true };
        }
        const target = parseLocalDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (target.getTime() === today.getTime()) {
            return { key: 'today', label: 'Hari Ini', isOverdue: false };
        }
        if (target.getTime() === tomorrow.getTime()) {
            return { key: 'tomorrow', label: 'Besok', isOverdue: false };
        }
        return {
            key: `date-${dateStr}`,
            label: `${DAYS[target.getDay()]}, ${target.getDate()} ${MONTHS[target.getMonth()]}`,
            isOverdue: false
        };
    }

    // ===== ID Generator =====
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ===== Render Everything =====
    function renderAll() {
        renderReminders();
        updateStats();
    }

    function getFilteredReminders() {
        const q = searchQuery.trim().toLowerCase();
        return reminders.filter((r) => {
            if (currentFilter === 'active' && r.done) return false;
            if (currentFilter === 'today' && !isToday(r.date)) return false;
            if (currentFilter === 'done' && !r.done) return false;

            if (q) {
                const haystack = `${r.title} ${r.description || ''} ${r.category || ''}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }

    function renderReminders() {
        const filtered = getFilteredReminders();

        if (filtered.length === 0) {
            reminderList.innerHTML = '';
            emptyState.style.display = 'block';
            if (searchQuery.trim()) {
                emptyTitle.textContent = 'Tidak ditemukan';
                emptyDesc.innerHTML = `Tidak ada pengingat yang cocok dengan "<strong>${escapeHtml(searchQuery.trim())}</strong>".`;
            } else if (currentFilter === 'done') {
                emptyTitle.textContent = 'Belum ada yang selesai';
                emptyDesc.textContent = 'Pengingat yang sudah kamu centang selesai akan tampil di sini.';
            } else if (currentFilter === 'today') {
                emptyTitle.textContent = 'Jadwal hari ini kosong';
                emptyDesc.textContent = 'Belum ada pengingat untuk hari ini. Nikmati harimu!';
            } else {
                emptyTitle.textContent = 'Belum ada reminder';
                emptyDesc.innerHTML = 'Ketuk tombol <strong>+ Baru</strong> di atas untuk membuat pengingat otomatis pertamamu.';
            }
            return;
        }

        emptyState.style.display = 'none';

        filtered.sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return getDateTimeStamp(a.date, a.time) - getDateTimeStamp(b.date, b.time);
        });

        // Group items cleanly preserving sort order
        const groups = [];
        const groupMap = new Map();

        filtered.forEach((r) => {
            const gInfo = r.done
                ? { key: 'done', label: 'Selesai', isOverdue: false }
                : getDateGroupInfo(r.date, r.time);

            if (!groupMap.has(gInfo.key)) {
                const group = { ...gInfo, items: [] };
                groupMap.set(gInfo.key, group);
                groups.push(group);
            }
            groupMap.get(gInfo.key).items.push(r);
        });

        let html = '';
        let cardIndex = 0;
        groups.forEach((group) => {
            html += `<div class="date-group-header ${group.isOverdue ? 'overdue-group' : ''}">${group.label}</div>`;
            group.items.forEach((r) => {
                html += createReminderCard(r, cardIndex++);
            });
        });

        reminderList.innerHTML = html;
    }

    function createReminderCard(r, index) {
        const overdue = isOverdue(r.date, r.time, r.done);
        const repeatLabel = getRepeatLabel(r.repeat);
        const countdown = getCountdownInfo(r.date, r.time, r.done);
        const delay = Math.min(index * 0.04, 0.24);
        const catNames = {
            pribadi: 'Pribadi',
            kerja: 'Kerja',
            kuliah: 'Kuliah',
            lainnya: 'Lainnya'
        };

        return `
        <article class="reminder-card ${r.done ? 'done' : ''} ${overdue ? 'overdue' : ''}"
                 data-id="${escapeHtml(r.id)}"
                 data-category="${escapeHtml(r.category || 'pribadi')}"
                 style="animation-delay:${delay}s">
            <div class="reminder-top">
                <button class="reminder-check" type="button"
                        onclick="app.toggleDone('${escapeHtml(r.id)}')"
                        aria-label="${r.done ? 'Tandai belum selesai' : 'Tandai selesai'}"></button>
                <div class="reminder-info">
                    <div class="reminder-title">${escapeHtml(r.title)}</div>
                    ${r.description ? `<div class="reminder-desc">${escapeHtml(r.description)}</div>` : ''}
                    <div class="reminder-meta">
                        <span class="reminder-time">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            ${formatDateLabel(r.date)} · ${escapeHtml(formatTime12h(r.time))}
                        </span>
                        ${countdown ? `<span class="countdown-chip ${countdown.cls}">${countdown.text}</span>` : ''}
                        <span class="reminder-badge badge-${escapeHtml(r.category || 'pribadi')}">
                            ${catNames[r.category] || 'Pribadi'}
                        </span>
                        ${repeatLabel ? `
                            <span class="badge-repeat">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="17 1 21 5 17 9"></polyline>
                                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                    <polyline points="7 23 3 19 7 15"></polyline>
                                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                                </svg>
                                ${repeatLabel}
                            </span>` : ''}
                    </div>
                </div>
                <div class="reminder-actions">
                    <button class="btn-action" type="button" onclick="app.editReminder('${escapeHtml(r.id)}')" aria-label="Edit" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-action btn-delete" type="button" onclick="app.deleteReminder('${escapeHtml(r.id)}')" aria-label="Hapus" title="Hapus">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </article>`;
    }

    function updateStats() {
        const total = reminders.length;
        const done = reminders.filter((r) => r.done).length;
        const active = total - done;
        const todayCount = reminders.filter((r) => isToday(r.date)).length;

        animateNumber(statTotal, total);
        animateNumber(statActive, active);
        animateNumber(statDone, done);

        countAll.textContent = total;
        countActive.textContent = active;
        countToday.textContent = todayCount;
        countDone.textContent = done;
    }

    function animateNumber(el, target) {
        const current = parseInt(el.textContent, 10) || 0;
        if (current === target) return;
        el.textContent = target;
        el.style.transform = 'scale(1.25)';
        setTimeout(() => { el.style.transform = 'scale(1)'; }, 220);
    }

    // ===== CRUD Operations =====
    function addReminder(data) {
        const reminder = {
            id: generateId(),
            title: data.title.trim(),
            description: (data.description || '').trim(),
            date: data.date,
            time: data.time,
            repeat: data.repeat || 'none',
            category: data.category || 'pribadi',
            done: false,
            createdAt: new Date().toISOString()
        };
        reminders.push(reminder);
        saveReminders();
        renderAll();
        showToast('Pengingat berhasil disimpan');
    }

    function updateReminder(id, data) {
        const idx = reminders.findIndex((r) => r.id === id);
        if (idx === -1) return;
        reminders[idx] = {
            ...reminders[idx],
            title: data.title.trim(),
            description: (data.description || '').trim(),
            date: data.date,
            time: data.time,
            repeat: data.repeat || 'none',
            category: data.category || 'pribadi'
        };
        notifiedIds.delete(id);
        saveNotifiedIds();
        saveReminders();
        renderAll();
        showToast('Pengingat berhasil diperbarui');
    }

    function deleteReminder(id) {
        if (!confirm('Hapus reminder ini?')) return;

        const card = document.querySelector(`[data-id="${id}"]`);
        const removeLogic = () => {
            reminders = reminders.filter((r) => r.id !== id);
            notifiedIds.delete(id);
            saveNotifiedIds();
            saveReminders();
            renderAll();
            showToast('Reminder dihapus');
        };

        if (card) {
            card.classList.add('removing');
            setTimeout(removeLogic, 280);
        } else {
            removeLogic();
        }
    }

    function toggleDone(id) {
        const r = reminders.find((item) => item.id === id);
        if (!r) return;

        if (!r.done && r.repeat && r.repeat !== 'none') {
            const nextDate = getNextRepeatDate(r.date, r.repeat);
            r.date = nextDate;
            r.done = false;
            notifiedIds.delete(id);
            saveNotifiedIds();
            showToast(`Dijadwalkan ulang untuk ${formatDateLabel(nextDate)}`);
        } else {
            r.done = !r.done;
            showToast(r.done ? 'Ditandai selesai' : 'Ditandai aktif kembali');
        }

        saveReminders();
        renderAll();
    }

    function snoozeReminder(id, minutes) {
        const r = reminders.find((item) => item.id === id);
        if (!r) return;

        const baseTs = Math.max(Date.now(), getDateTimeStamp(r.date, r.time));
        const snoozeDate = new Date(baseTs + minutes * 60000);
        r.date = toLocalDateStr(snoozeDate);
        r.time = toLocalTimeStr(snoozeDate);
        r.done = false;

        notifiedIds.delete(id);
        saveNotifiedIds();
        saveReminders();
        renderAll();
        showToast(`Ditunda ${minutes} menit (${formatTime12h(r.time)})`);
    }

    function getNextRepeatDate(dateStr, repeat) {
        const d = parseLocalDate(dateStr);
        if (repeat === 'daily') {
            d.setDate(d.getDate() + 1);
        } else if (repeat === 'weekly') {
            d.setDate(d.getDate() + 7);
        } else if (repeat === 'monthly') {
            const origDay = d.getDate();
            d.setMonth(d.getMonth() + 1);
            // Guard end-of-month rollover (e.g. Jan 31 -> Feb 28)
            if (d.getDate() !== origDay) {
                d.setDate(0);
            }
        }
        return toLocalDateStr(d);
    }

    function editReminder(id) {
        const r = reminders.find((item) => item.id === id);
        if (!r) return;

        inputTitle.value = r.title;
        inputDesc.value = r.description || '';
        inputDate.value = r.date;
        setTimePickerValue(r.time);
        inputRepeat.value = r.repeat || 'none';
        editIdInput.value = r.id;

        const catRadio = document.querySelector(`input[name="category"][value="${r.category || 'pribadi'}"]`);
        if (catRadio) catRadio.checked = true;

        modalTitle.textContent = 'Edit Reminder';
        btnSubmitText.textContent = 'Perbarui';
        openModal();
    }

    // ===== Add/Edit Modal =====
    function openModal() {
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => inputTitle.focus(), 320);
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        resetForm();
    }

    function resetForm() {
        reminderForm.reset();
        editIdInput.value = '';
        modalTitle.textContent = 'Tambah Reminder';
        btnSubmitText.textContent = 'Simpan Reminder';

        const defaultTarget = new Date(Date.now() + 30 * 60000);
        inputDate.value = toLocalDateStr(defaultTarget);
        setTimePickerValue(toLocalTimeStr(defaultTarget));
    }

    // ===== Web Audio Gentle Jade Chime =====
    function playJadeChime() {
        if (!soundEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            if (!audioCtx) audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const now = audioCtx.currentTime;
            const notes = [587.33, 880.0, 1174.66]; // D5 -> A5 -> D6 soft harmonic chime
            notes.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.14);

                gain.gain.setValueAtTime(0.0001, now + i * 0.14);
                gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.14 + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.9);

                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + i * 0.14);
                osc.stop(now + i * 0.14 + 0.95);
            });
        } catch (e) {
            // Audio playback requires prior user gesture on some mobile browsers
        }
    }

    // ===== In-App Alarm Popup =====
    function showAlarmPopup(reminder) {
        activeAlarmId = reminder.id;
        alarmTitle.textContent = reminder.title;
        alarmDesc.textContent = reminder.description || 'Sudah masuk jadwal pengingatmu.';
        alarmTimeLabel.textContent = `${formatDateLabel(reminder.date)} · ${formatTime12h(reminder.time)}`;
        alarmOverlay.classList.add('active');
    }

    function closeAlarmPopup() {
        alarmOverlay.classList.remove('active');
        activeAlarmId = null;
    }

    // ===== Notifications (HP & Laptop Compatible) =====
    function updateNotificationUI() {
        if (!('Notification' in window)) {
            notifStatusText.textContent = 'Alarm In-App';
            notifStatusBtn.classList.remove('granted', 'denied');
            notifBanner.style.display = 'none';
            return;
        }

        const perm = Notification.permission;
        notifStatusBtn.classList.remove('granted', 'denied');

        if (perm === 'granted') {
            notifStatusBtn.classList.add('granted');
            notifStatusText.textContent = 'Notif Aktif · Tes';
            notifBanner.style.display = 'none';
        } else if (perm === 'denied') {
            notifStatusBtn.classList.add('denied');
            notifStatusText.textContent = 'Notif Diblokir';
            notifBanner.style.display = 'none';
        } else {
            notifStatusText.textContent = 'Aktifkan Notif';
            notifBanner.style.display = 'block';
        }
    }

    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            showToast('Browser ini memakai alarm suara/popup dalam aplikasi');
            return;
        }

        if (Notification.permission === 'granted') {
            await triggerTestNotification();
            return;
        }

        if (Notification.permission === 'denied') {
            showToast('Izin notifikasi diblokir. Aktifkan di pengaturan browser.');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            updateNotificationUI();
            if (permission === 'granted') {
                showToast('Notifikasi otomatis diaktifkan!');
                await showSystemNotification('Reminder Giok Aktif', {
                    body: 'Pengingat otomatis siap berjalan di perangkat ini.',
                    tag: 'welcome-test'
                });
                playJadeChime();
            } else {
                showToast('Notifikasi tidak diizinkan');
            }
        } catch (err) {
            showToast('Gagal meminta izin notifikasi');
        }
    }

    async function triggerTestNotification() {
        playJadeChime();
        await showSystemNotification('Tes Reminder Giok', {
            body: 'Notifikasi dan alarm berfungsi dengan baik!',
            tag: 'manual-test'
        });
        showToast('Notifikasi tes dikirim!');
    }

    async function showSystemNotification(title, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const payload = {
            body: options.body || 'Waktunya pengingatmu tiba!',
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-72.png',
            tag: options.tag || 'reminder-notif',
            requireInteraction: true,
            vibrate: [200, 100, 200]
        };

        try {
            // Android Chrome PWA requires ServiceWorkerRegistration.showNotification()
            if (swRegistration && swRegistration.showNotification) {
                await swRegistration.showNotification(title, payload);
                return;
            }
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, payload);
                    return;
                }
            }
            const n = new Notification(title, payload);
            n.onclick = () => {
                window.focus();
                n.close();
            };
        } catch (e) {
            // Fallback silently if running in restricted context
        }
    }

    function sendReminderAlert(reminder) {
        playJadeChime();
        showAlarmPopup(reminder);
        showSystemNotification(`Pengingat: ${reminder.title}`, {
            body: reminder.description || `Jadwal pukul ${formatTime12h(reminder.time)} telah tiba.`,
            tag: `reminder-${reminder.id}`
        });
        flashTitle(reminder.title);
    }

    // ===== Reminder Checker =====
    function startTimers() {
        checkReminders();
        setInterval(checkReminders, CHECK_INTERVAL);
        setInterval(updateHeaderClock, 10000);
    }

    function checkReminders() {
        const now = Date.now();
        let triggeredCount = 0;

        reminders.forEach((r) => {
            if (r.done) return;
            if (notifiedIds.has(r.id)) return;

            const reminderTime = getDateTimeStamp(r.date, r.time);
            const diff = now - reminderTime;

            // Fire if within 15s before up to 5 minutes after scheduled time
            if (diff >= -15000 && diff <= 300000) {
                notifiedIds.add(r.id);
                triggeredCount++;
                sendReminderAlert(r);
            }
        });

        if (triggeredCount > 0) {
            saveNotifiedIds();
        }

        renderAll();
    }

    function flashTitle(reminderTitle) {
        const originalTitle = 'Reminder Giok — Pengingat Otomatis';
        let flash = true;
        const flashInterval = setInterval(() => {
            document.title = flash ? `Waktunya: ${reminderTitle}` : originalTitle;
            flash = !flash;
        }, 1000);

        setTimeout(() => {
            clearInterval(flashInterval);
            document.title = originalTitle;
        }, 10000);
    }

    // ===== Transfer / Backup (HP ↔ Laptop) =====
    function openSyncModal() {
        importTextarea.value = '';
        syncOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSyncModal() {
        syncOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function getBackupPayload() {
        return JSON.stringify({
            app: 'reminder-giok',
            exportedAt: new Date().toISOString(),
            reminders
        }, null, 2);
    }

    async function copyBackupCode() {
        const json = getBackupPayload();
        try {
            await navigator.clipboard.writeText(json);
            showToast('Kode backup disalin ke clipboard');
        } catch (e) {
            importTextarea.value = json;
            importTextarea.select();
            showToast('Silakan salin kode di kotak teks');
        }
    }

    function downloadBackupFile() {
        const json = getBackupPayload();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reminder-giok-${toLocalDateStr(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('File backup .json diunduh');
    }

    function parseImportedData(rawText) {
        const trimmed = (rawText || '').trim();
        if (!trimmed) {
            showToast('Tempel kode backup atau pilih file dulu');
            return null;
        }
        try {
            const parsed = JSON.parse(trimmed);
            const list = Array.isArray(parsed) ? parsed : parsed.reminders;
            if (!Array.isArray(list)) {
                showToast('Format backup tidak dikenali');
                return null;
            }
            const valid = list.filter((item) => item && typeof item.title === 'string' && item.date && item.time);
            return valid.map((item) => ({
                id: item.id || generateId(),
                title: String(item.title).slice(0, 100),
                description: String(item.description || '').slice(0, 500),
                date: String(item.date),
                time: String(item.time),
                repeat: ['none', 'daily', 'weekly', 'monthly'].includes(item.repeat) ? item.repeat : 'none',
                category: ['pribadi', 'kerja', 'kuliah', 'lainnya'].includes(item.category) ? item.category : 'pribadi',
                done: Boolean(item.done),
                createdAt: item.createdAt || new Date().toISOString()
            }));
        } catch (e) {
            showToast('Data JSON tidak valid');
            return null;
        }
    }

    function importReminders(mode) {
        const imported = parseImportedData(importTextarea.value);
        if (!imported) return;

        if (mode === 'replace') {
            if (!confirm(`Ganti semua data saat ini dengan ${imported.length} reminder hasil impor?`)) return;
            reminders = imported;
            notifiedIds.clear();
        } else {
            const existingIds = new Set(reminders.map((r) => r.id));
            let added = 0;
            imported.forEach((item) => {
                if (!existingIds.has(item.id)) {
                    reminders.push(item);
                    added++;
                }
            });
            showToast(`${added} reminder baru digabungkan`);
            saveReminders();
            saveNotifiedIds();
            renderAll();
            closeSyncModal();
            return;
        }

        saveReminders();
        saveNotifiedIds();
        renderAll();
        closeSyncModal();
        showToast(`${imported.length} reminder berhasil dimuat`);
    }

    // ===== Toast =====
    function showToast(message) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    // ===== Utility =====
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str ?? '');
        return div.innerHTML;
    }

    // ===== Service Worker =====
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = await navigator.serviceWorker.register('sw.js');
            } catch (err) {
                swRegistration = null;
            }
        }
    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        // Add button
        btnAdd.addEventListener('click', () => {
            resetForm();
            openModal();
        });

        // Close Add/Edit modal
        btnCloseModal.addEventListener('click', closeModal);
        btnCancel.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // AM / PM toggle buttons
        btnAm.addEventListener('click', () => setPeriod('AM'));
        btnPm.addEventListener('click', () => setPeriod('PM'));

        // Form submit
        reminderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const category = document.querySelector('input[name="category"]:checked')?.value || 'pribadi';
            const data = {
                title: inputTitle.value,
                description: inputDesc.value,
                date: inputDate.value,
                time: getTimePickerValue(),
                repeat: inputRepeat.value,
                category
            };
            const editId = editIdInput.value;
            if (editId) updateReminder(editId, data);
            else addReminder(data);
            closeModal();
        });

        // Filter tabs
        $$('.filter-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                $$('.filter-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.dataset.filter;
                renderReminders();
            });
        });

        // Search box
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            btnClearSearch.style.display = searchQuery ? 'flex' : 'none';
            renderReminders();
        });

        btnClearSearch.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            btnClearSearch.style.display = 'none';
            renderReminders();
            searchInput.focus();
        });

        // Notification controls
        notifStatusBtn.addEventListener('click', requestNotificationPermission);
        btnEnableNotif.addEventListener('click', requestNotificationPermission);
        btnDismissNotif.addEventListener('click', () => {
            notifBanner.style.display = 'none';
        });

        // Sound toggle
        btnSoundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem(SOUND_KEY, String(soundEnabled));
            updateSoundUI();
            if (soundEnabled) {
                playJadeChime();
                showToast('Suara alarm diaktifkan');
            } else {
                showToast('Suara alarm dimatikan');
            }
        });

        // Alarm popup actions
        btnAlarmDone.addEventListener('click', () => {
            if (activeAlarmId) toggleDone(activeAlarmId);
            closeAlarmPopup();
        });

        btnAlarmSnooze.addEventListener('click', () => {
            if (activeAlarmId) snoozeReminder(activeAlarmId, 10);
            closeAlarmPopup();
        });

        btnAlarmClose.addEventListener('click', closeAlarmPopup);

        // Sync / Backup modal
        btnBackup.addEventListener('click', openSyncModal);
        btnCloseSync.addEventListener('click', closeSyncModal);
        syncOverlay.addEventListener('click', (e) => {
            if (e.target === syncOverlay) closeSyncModal();
        });
        btnCopyBackup.addEventListener('click', copyBackupCode);
        btnExportJson.addEventListener('click', downloadBackupFile);
        btnImportMerge.addEventListener('click', () => importReminders('merge'));
        btnImportReplace.addEventListener('click', () => importReminders('replace'));

        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                importTextarea.value = ev.target?.result || '';
                showToast('File dimuat, pilih Gabungkan atau Ganti Semua');
            };
            reader.readAsText(file);
            importFileInput.value = '';
        });

        // Keyboard ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                closeSyncModal();
                closeAlarmPopup();
            }
        });

        // Re-check immediately when returning to tab or unlocking phone
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                updateHeaderClock();
                checkReminders();
            }
        });
    }

    // ===== Expose inline card handlers =====
    window.app = {
        toggleDone,
        editReminder,
        deleteReminder
    };

    document.addEventListener('DOMContentLoaded', init);
})();
