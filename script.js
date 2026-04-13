let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
tasks = tasks.map(t => t.project === 'team' ? { ...t, project: 'work' } : t);

let users = JSON.parse(localStorage.getItem("tf_users")) || [];
let currentUser = JSON.parse(localStorage.getItem("tf_current_user")) || null;
let activeModalTaskId = null;
let generatedOTP = null;
 // Stores IDs of checked tasks
let isSelectionMode = false;
let selectedTaskIds = [];

window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem("tf_current_user");
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        
        // Agar user pehle se hai, toh Welcome page ko bina animation ke turant chhupao
        const welcome = document.getElementById("welcomePage");
        if (welcome) {
            welcome.style.display = "none";
        }
        
        // UI par user ka naam set karo
        const mainTitle = document.getElementById("mainTitle");
        if(mainTitle) mainTitle.innerHTML = `Welcome back, ${currentUser.name} ⚡`;
        
        renderTasks(); // Tasks load karo
    }
});

let searchQuery = ""; // 🔥 Global search state
let showRepeatingHistory = false;

window.addEventListener('DOMContentLoaded', () => {
    // ... existing login logic ...
    
    const repeatToggle = document.getElementById("repeatingFilter");
    if (repeatToggle) {
        repeatToggle.onchange = (e) => {
            showRepeatingHistory = e.target.checked;
            renderTasks();
        };
    }
});

// 🔥 Search Input Listener
const searchInput = document.getElementById("taskSearchInput");
if(searchInput) {
    searchInput.oninput = (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderTasks(); // Type karte hi list refresh hogi
    };
}

let editModeId = null;
let currentSort = "newest"; // 🔥 Default sorting state

// The Timezone Fix
const getLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseLocalDate = (str) => { 
    if(!str) return new Date(); 
    const [y,m,d] = str.split('-'); 
    return new Date(y, m-1, d); 
};

// 🔥 THE 12-HOUR FORMATTER 🔥
function format12Hour(timeStr) {
    if (!timeStr) return "";
    let [h, m] = timeStr.split(":");
    h = parseInt(h, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// 🔥 UI HOTFIX: STOPS THE EDIT/DELETE BUTTONS FROM STRETCHING 🔥
if (!document.getElementById("modal-btn-fix")) {
    const style = document.createElement("style");
    style.id = "modal-btn-fix";
    style.innerHTML = `
        .modal-footer-modern { justify-content: center !important; }
        .m-btn-edit, .m-btn-del, .m-btn-break { flex: 1 !important; max-width: 220px !important; }
    `;
    document.head.appendChild(style);
}

let currentSec = "all";
let curDate = new Date();
let calView = "month";

let zenTimer = null;
let zenTimeLeft = 0;
let zenIsRunning = false;
let currentZenTaskId = null;

const saveToLocal = () => localStorage.setItem("tasks", JSON.stringify(tasks));

function showToast(msg, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-info-circle"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// 🔥 SORT DROPDOWN LISTENER 🔥
const sortSelect = document.getElementById("taskSortSelect");
if(sortSelect) {
    sortSelect.onchange = (e) => {
        currentSort = e.target.value;
        renderTasks();
    };
}

// SHOW/HIDE CUSTOM REMINDER INPUT
const remOffset = document.getElementById("reminderOffset");
if (remOffset) {
    remOffset.addEventListener("change", function() {
        const customInput = document.getElementById("customReminder");
        if (customInput) {
            if (this.value === "custom") customInput.classList.remove("hidden");
            else customInput.classList.add("hidden");
        }
    });
}

// NOTIFICATION ENGINE
if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
    Notification.requestPermission();
}

setInterval(() => {
    if (Notification.permission === "granted") {
        const now = new Date();
        const todayISO = getLocalISO(now);
        let changed = false;
        tasks.forEach(t => {
            if (!t.completed && !t.notified) {
                if (t.reminderOffset === "custom" && t.customReminder) {
                    const customTarget = new Date(t.customReminder);
                    if (!isNaN(customTarget)) {
                        if (
                            customTarget.getFullYear() === now.getFullYear() &&
                            customTarget.getMonth() === now.getMonth() &&
                            customTarget.getDate() === now.getDate() &&
                            customTarget.getHours() === now.getHours() &&
                            customTarget.getMinutes() === now.getMinutes()
                        ) {
                            new Notification("TaskFlow Reminder 🔔", { body: `Custom Reminder: ${t.title}` });
                            t.notified = true;
                            changed = true;
                        }
                    }
                } 
                else if (t.deadline === todayISO && t.time && t.reminderOffset !== "none") {
                    const timeParts = t.time.split(':');
                    if (timeParts.length === 2) {
                        const [hours, minutes] = timeParts.map(Number);
                        const taskTimeDate = new Date(now);
                        taskTimeDate.setHours(hours, minutes, 0, 0);
                        const offset = parseInt(t.reminderOffset || "0");
                        if (!isNaN(offset)) taskTimeDate.setMinutes(taskTimeDate.getMinutes() - offset);
                        const targetStr = `${String(taskTimeDate.getHours()).padStart(2, '0')}:${String(taskTimeDate.getMinutes()).padStart(2, '0')}`;
                        const currentStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        if (currentStr === targetStr) {
                            const notifyMessage = offset === 0 ? `It's time to work on: ${t.title}` : `Starting in ${offset} mins: ${t.title}`;
                            new Notification("TaskFlow Reminder 🔔", { body: notifyMessage });
                            t.notified = true;
                            changed = true;
                        }
                    }
                }
            }
        });
        if (changed) saveToLocal();
    }
}, 60000);

document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const title = btn.innerText.trim();
        if (title) document.getElementById("mainTitle").innerText = title; 
        const target = btn.dataset.section;
        
        // 🔥 THE FIX: Hide the "Show Repeating Tasks" filter in specific sections
        const repeatFilter = document.querySelector(".filter-container");
        if (repeatFilter) {
            if (["profile", "add", "pending", "archive"].includes(target)) {
                repeatFilter.style.display = "none"; // Hide it
            } else {
                repeatFilter.style.display = "flex"; // Show it
            }
        }

        document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
        const calControls = document.getElementById("calendarControls");
        if (calControls) calControls.classList.add("hidden");
        if (zenIsRunning) { clearInterval(zenTimer); zenIsRunning = false; }
        
        if (target === "calendar") {
            document.getElementById("calendarSection").classList.remove("hidden");
            if (calControls) calControls.classList.remove("hidden");
            renderCal();
        } else if (target === "add") {
            resetForm();
            document.getElementById("addSection").classList.remove("hidden");
        } else {
            currentSec = target;
            document.getElementById("taskSection").classList.remove("hidden");
            renderTasks();
        }
    };
});

function startZenMode(taskId) {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    currentZenTaskId = t.id;
    document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
    document.getElementById("zenSection").classList.remove("hidden");
    document.getElementById("mainTitle").innerText = "Zen Focus";
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("zenTaskTitle").innerText = t.title;
    document.getElementById("zenHoursInput").value = "0";
    document.getElementById("zenMinutesInput").value = "25";
    document.getElementById("zenInputPhase").classList.remove("hidden");
    document.getElementById("zenTimerPhase").classList.add("hidden");
    document.getElementById("zenCompleteBtn").classList.add("hidden");
    const startBtn = document.getElementById("zenStartBtn");
    startBtn.innerHTML = `<i class="fas fa-play"></i> Start Timer`;
    startBtn.style.background = ""; 
    clearInterval(zenTimer); zenIsRunning = false;
}

function updateZenDisplay() {
    const h = Math.floor(zenTimeLeft / 3600), m = Math.floor((zenTimeLeft % 3600) / 60), s = zenTimeLeft % 60;
    if (h > 0) document.getElementById("zenTimerDisplay").innerText = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    else document.getElementById("zenTimerDisplay").innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

document.getElementById("zenStartBtn").onclick = () => {
    const btn = document.getElementById("zenStartBtn");
    if (!document.getElementById("zenInputPhase").classList.contains("hidden")) {
        const h = parseInt(document.getElementById("zenHoursInput").value) || 0, m = parseInt(document.getElementById("zenMinutesInput").value) || 0;
        let totalSeconds = (h * 3600) + (m * 60);
        if (totalSeconds <= 0) totalSeconds = 25 * 60; 
        zenTimeLeft = totalSeconds;
        document.getElementById("zenInputPhase").classList.add("hidden");
        document.getElementById("zenTimerPhase").classList.remove("hidden");
        document.getElementById("zenCompleteBtn").classList.remove("hidden");
        updateZenDisplay();
    }
    if (zenIsRunning) { clearInterval(zenTimer); zenIsRunning = false; btn.innerHTML = `<i class="fas fa-play"></i> Resume`; btn.style.background = ""; }
    else {
        zenIsRunning = true; btn.innerHTML = `<i class="fas fa-pause"></i> Pause`; btn.style.background = "var(--medium)";
        zenTimer = setInterval(() => {
            if (zenTimeLeft > 0) { zenTimeLeft--; updateZenDisplay(); }
            else { clearInterval(zenTimer); zenIsRunning = false; showToast("Time's up! Incredible focus.", "success"); btn.innerHTML = `<i class="fas fa-check-double"></i> Finished`; }
        }, 1000);
    }
};

document.getElementById("zenCompleteBtn").onclick = () => {
    if (currentZenTaskId) {
        const fakeEvent = { stopPropagation: () => {} };
        toggleTask(fakeEvent, currentZenTaskId);
        clearInterval(zenTimer); zenIsRunning = false;
        document.querySelector('[data-section="all"]').click();
    }
};

function getTasksForDate(dStr) {
    return tasks.filter(t => {
        if (t.parentId) return false; // Hide subtasks in calendar
        
        // Strictly show the task ONLY on its current assigned deadline
        if (t.deadline === dStr) return true;
        
        return false;
    });
}

function renderTaskLine(t) {
    const op = t.completed ? 0.3 : 1;
    return `<div style="width:100%; background: var(--${t.priority}); height: 4px; margin-top:4px; opacity:${op}; border-radius: 2px;"></div>`;
}

function updateCalendarHeader() {
    const title = document.getElementById("calendarMonthYear");
    if(!title) return;
    if (calView === "month") title.innerText = curDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    else if (calView === "day") title.innerText = curDate.toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' });
    else {
        const start = new Date(curDate);
        const diff = start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1);
        const mon = new Date(start.setDate(diff)), sun = new Date(start.setDate(diff + 6));
        title.innerText = `${mon.toLocaleDateString('default', { day: 'numeric', month: 'short' })} - ${sun.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
}

function renderCal() {
    const grid = document.getElementById("calendarGrid"), labels = document.getElementById("calendarLabelsRow");
    if(!grid || !labels) return;
    grid.innerHTML = ""; labels.classList.remove("hidden"); updateCalendarHeader();
    if (calView === "month") {
        grid.style.display = "grid";
        const y = curDate.getFullYear(), m = curDate.getMonth();
        const shift = (new Date(y, m, 1).getDay() || 7) - 1, totalDays = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < shift; i++) grid.innerHTML += `<div class="day-box" style="opacity:0.1"></div>`;
        for (let d = 1; d <= totalDays; d++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const box = document.createElement("div"); box.className = "day-box"; box.onclick = () => openDaySummary(dStr);
            const dayTasks = getTasksForDate(dStr);
            box.innerHTML = `<strong>${d}</strong><div style="margin-top:8px">${dayTasks.map(t => renderTaskLine(t)).join('')}</div>`;
            grid.appendChild(box);
        }
    } else if (calView === "week") {
        grid.style.display = "grid";
        const start = new Date(curDate), diff = start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1), mon = new Date(start.setDate(diff));
        for (let i = 0; i < 7; i++) {
            const d = new Date(mon); d.setDate(mon.getDate() + i);
            const dStr = getLocalISO(d), box = document.createElement("div"); box.className = "day-box"; box.onclick = () => openDaySummary(dStr);
            const dayTasks = getTasksForDate(dStr);
            box.innerHTML = `<strong>${d.getDate()} ${d.toLocaleString('default',{weekday:'short'})}</strong><div style="margin-top:10px">${dayTasks.map(t => renderTaskLine(t)).join('')}</div>`;
            grid.appendChild(box);
        }
    } else {
        grid.style.display = "block"; labels.classList.add("hidden");
        const todayStr = getLocalISO(curDate), dayTasks = getTasksForDate(todayStr);
        for (let h = 9; h <= 20; h++) {
            const row = document.createElement("div");
            row.style.cssText = "display:flex; border-bottom:1px solid var(--border); min-height:80px;";
            row.innerHTML = `<div style="width:80px; padding:20px; font-size:0.7rem; font-weight:800; color:var(--text-dim); border-right:1px solid var(--border)">${format12Hour(h+":00")}</div><div style="flex-grow:1; padding:15px; display:flex; gap:10px;">${dayTasks.filter(t => parseInt(t.time) === h || (!t.time && h===9)).map(t => `<div class="task" style="margin:0; padding:10px; font-size:0.8rem; flex-grow:1;" onclick="openTaskModal(${t.id})">${t.title}</div>`).join('')}</div>`;
            grid.appendChild(row);
        }
    }
}

const prevBtn = document.getElementById("prevBtn");
if(prevBtn) prevBtn.onclick = () => { calView==='month' ? curDate.setMonth(curDate.getMonth()-1) : (calView==='week' ? curDate.setDate(curDate.getDate()-7) : curDate.setDate(curDate.getDate()-1)); renderCal(); };
const nextBtn = document.getElementById("nextBtn");
if(nextBtn) nextBtn.onclick = () => { calView==='month' ? curDate.setMonth(curDate.getMonth()+1) : (calView==='week' ? curDate.setDate(curDate.getDate()+7) : curDate.setDate(curDate.getDate()+1)); renderCal(); };
document.querySelectorAll(".v-btn").forEach(btn => { if(btn.id !== "listViewBtn" && btn.id !== "gridViewBtn") { btn.onclick = () => { document.querySelectorAll(".v-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); calView = btn.dataset.view; renderCal(); }; } });


/* --- 🔥 RECURRING TASKS: CLONE FOR HISTORY --- */
/* --- 🔥 RECURRING TASKS: FINAL LOGIC --- */
function resetRecurringTasks() {
    const todayISO = getLocalISO(new Date());
    let newTasksCreated = [];
    let changed = false;

    tasks = tasks.map(t => {
        if (t.completed && t.repeat && t.repeat !== 'none' && t.completedDate && t.completedDate < todayISO) {
            
            let nextDate = parseLocalDate(t.deadline);
            if (t.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1);
            else if (t.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7);

            const nextDateISO = getLocalISO(nextDate);

            // 1. CHECK END CONDITION
            let shouldRepeat = true;
            

            if (shouldRepeat) {
                changed = true;
                newTasksCreated.push({
                    ...t,
                    id: Date.now() + Math.random(),
                    deadline: nextDateISO,
                    completed: false,
                    completedDate: null,
                    updatedAt: Date.now()
                });
            }

            // Purani task ko record mein rehne do par uska repeat 'none' kardo
            return { ...t, repeat: 'none', isRepeatingHistory: true };
        }
        return t;
    });

    if (newTasksCreated.length > 0) tasks.push(...newTasksCreated);
    if (changed) saveToLocal();
}

// 🔥 RENDER TASKS WITH SMART SORTING 🔥
function renderTasks() {
    resetRecurringTasks();

    const sectionTitle = document.getElementById("mainTitle");
    const searchCont = document.querySelector(".search-container");
    const sortCont = document.getElementById("sortControls");
    const list = document.getElementById("taskSection");

    if (!list) return;
    
    

    // --- 1. PROFILE SECTION CHECK ---
    if (currentSec === "profile") {
        if (sectionTitle) sectionTitle.innerText = "Your Profile";
        
        // Hide Search and Sort for clean profile view
        if (searchCont) searchCont.style.display = "none";
        if (sortCont) sortCont.style.display = "none";

        list.innerHTML = ""; // Clear list
        renderProfileView(list); // ✅ Profile card call
        return; 
    }

    // --- 2. RESET UI FOR TASKS ---
    if (searchCont) searchCont.style.display = "flex";
    if (sortCont) sortCont.style.display = "flex";
    list.innerHTML = ""; // ✅ Filter ke bahar sirf ek baar clear karein

    // --- 3. FILTERING LOGIC ---
    let filtered = tasks.filter(t => {
        

        if (!showRepeatingHistory) {
            if (t.isRepeatingHistory) return false;

            // Extra check for your current screen: 
            // Hide completed tasks if there is another task with the same name that is NOT completed
            if (t.completed) {
                const hasActiveVersion = tasks.some(task => 
                    task.title === t.title && !task.completed && task.id !== t.id
                );
                if (hasActiveVersion) return false;
            }
        }

        if (t.parentId) return false;
        const searchMatch = t.title.toLowerCase().includes(searchQuery) || 
                           (t.desc && t.desc.toLowerCase().includes(searchQuery));

        if (currentSec === "archived") {
            if (!t.isArchived) return false;
        } else {
            if (t.isArchived) return false;
        }

        let secMatch = false;
        if (currentSec === "all" || currentSec === "archived") {
            secMatch = true;
        } else if (currentSec === "pending") {
            secMatch = !t.completed;
        } else if (currentSec === "completed") {
            secMatch = t.completed;
        } else {
            secMatch = (t.project || "personal") === currentSec;
        }

        return secMatch && searchMatch;
    });

    // --- 4. SORTING LOGIC ---
    const priorityMap = { "high": 0, "medium": 1, "low": 2 };
    filtered.sort((a, b) => {
        if (currentSort === "newest") return (b.id || 0) - (a.id || 0);
        if (currentSort === "oldest") return (a.id || 0) - (b.id || 0);
        if (currentSort === "recently_edited") return (b.updatedAt || 0) - (a.updatedAt || 0);
        if (currentSort === "date_asc") return a.deadline.localeCompare(b.deadline);
        if (currentSort === "date_desc") return b.deadline.localeCompare(a.deadline);
        if (currentSort === "priority_smart") {
            const dateComp = a.deadline.localeCompare(b.deadline);
            if (dateComp !== 0) return dateComp;
            return priorityMap[a.priority] - priorityMap[b.priority];
        }
        return 0;
    });

    // --- 5. DRAWING THE TASKS ---
    filtered.forEach(t => {
        // Render Parent Task

        const div = document.createElement("div"); 
        
        const isSelected = selectedTaskIds.includes(t.id);

        div.className = `task ${t.completed ? 'completed' : ''} ${isSelected ? 'is-selected' : ''}`;
        let toggleHtml = t.hasSubtasks ? 
            `<div class="subtask-toggle" onclick="toggleExpand(event, ${t.id})"><i class="fas ${t.isExpanded ? "fa-chevron-down" : "fa-chevron-right"}"></i></div>` : '';

        const projectTag = `<span style="font-size: 0.65rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; background: var(--border); color: var(--text-dim); margin-left: 10px;">${(t.project || 'personal').toUpperCase()}</span>`;
        const timeDisplay = t.time ? ` at ${format12Hour(t.time)}` : "";
        div.innerHTML = `
            <input type="checkbox" class="task-checkbox" 
                ${isSelected ? 'checked' : ''} 
                onclick="event.stopPropagation(); toggleTaskSelection(${t.id})">
            
            <div style="width:6px; height:40px; border-radius:10px; background:var(--${t.priority});"></div>
            
            <div style="flex-grow:1; margin-left:20px;" onclick="${isSelectionMode ? `toggleTaskSelection(${t.id})` : `openTaskModal(${t.id})`}">
                <h4 style="font-weight:900;">${t.title}</h4>
                <p>Due: ${t.deadline}</p>
            </div>

            <div class="check-circle" onclick="toggleTask(event, ${t.id})">
                ${t.completed ? '<i class="fas fa-check"></i>' : ''}
            </div>`;
        list.appendChild(div);

        // 🔥 NEW: Agar Parent Expanded hai, toh uske subtasks render karo
        if (t.hasSubtasks && t.isExpanded) {
            const subtasks = tasks.filter(st => st.parentId === t.id); // Bacche dhoondo
            subtasks.forEach(st => {
                const subDiv = document.createElement("div");
                // 'sub-task' class handles the 50px indentation
                subDiv.className = `task sub-task ${st.completed ? 'completed' : ''}`;
                
                const subProjectTag = `<span style="font-size: 0.65rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; background: var(--border); color: var(--text-dim); margin-left: 10px;">${(st.project || 'personal').toUpperCase()}</span>`;
                
                const isSubSelected = selectedTaskIds.includes(st.id);
                const timeDisplay = t.time ? ` at ${format12Hour(st.time)}` : "";
                subDiv.innerHTML = `
                    <input type="checkbox" class="task-checkbox" ${isSubSelected ? 'checked' : ''} 
                           onclick="event.stopPropagation(); toggleTaskSelection(${st.id})">
                    <div style="width:6px; height:40px; border-radius:10px; background:var(--${st.priority}); flex-shrink: 0;"></div>
                    <div style="flex-grow:1; margin-left:20px; overflow: hidden;" onclick="openTaskModal(${st.id})">
                        <h4 style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${st.title} ${subProjectTag}</h4>
                        <p style="font-size:0.85rem; color:var(--text-dim); margin-top: 4px;">Due: ${st.deadline}${timeDisplay}</p>
                    </div>
                    <div class="check-circle" style="flex-shrink: 0;" onclick="toggleTask(event, ${st.id})">
                        ${st.completed ? '<i class="fas fa-check"></i>' : ''}
                    </div>`;
                list.appendChild(subDiv);
            });
        }
        
    });
}

// 🔥 YE FUNCTION BHI UPDATE KAR LO (todo.js mein renderTasks ke niche dalo)
function renderProfileView(container) {
    if (!currentUser) {
        container.innerHTML = `<div class="empty-state" style="text-align:center; padding:50px; color:var(--text);">Please log in to view profile.</div>`;
        return;
    }

    const avatar = `https://ui-avatars.com/api/?name=${currentUser.name}&background=a855f7&color=fff&size=128`;

    container.innerHTML = `
        <div class="profile-dashboard-wrapper" style="display:flex; justify-content:center; padding:40px 20px; animation: fadeInUp 0.5s ease;">
            <div class="profile-main-card" style="background:var(--card); width:100%; max-width:650px; padding:50px; border-radius:35px; box-shadow:var(--shadow); text-align:center; border:1px solid var(--border);">
                
                <div class="profile-top" style="margin-bottom:40px; border-bottom:1px solid var(--border); padding-bottom:40px;">
                    <img src="${avatar}" style="width:130px; border-radius:50%; border:5px solid #a855f7; margin-bottom:20px; box-shadow: 0 10px 30px -10px rgba(168, 85, 247, 0.4);">
                    <h2 style="font-size:2.8rem; font-weight:900; margin-bottom:5px; color:var(--text); letter-spacing:-1px;">${currentUser.name}</h2>
                    <p style="color:var(--text-dim); font-weight:600; font-size:1.05rem;">${currentUser.email || currentUser.mobile}</p>
                </div>

                <div class="profile-info-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:15px; margin-bottom:40px;">
                    <div style="background:var(--bg); padding:20px; border-radius:20px; border:1px solid var(--border);">
                        <span style="font-size:0.75rem; color:var(--text-dim); font-weight:800; text-transform:uppercase;">Age</span>
                        <p style="font-weight:900; font-size:1.3rem; margin-top:8px; color:var(--text);">${currentUser.age}</p>
                    </div>
                    <div style="background:var(--bg); padding:20px; border-radius:20px; border:1px solid var(--border);">
                        <span style="font-size:0.75rem; color:var(--text-dim); font-weight:800; text-transform:uppercase;">Gender</span>
                        <p style="font-weight:900; font-size:1.3rem; margin-top:8px; color:var(--text); text-transform:capitalize;">${currentUser.gender}</p>
                    </div>
                    <div style="background:var(--bg); padding:20px; border-radius:20px; border:1px solid var(--border);">
                        <span style="font-size:0.75rem; color:var(--text-dim); font-weight:800; text-transform:uppercase;">Contact</span>
                        <p style="font-weight:900; font-size:1rem; margin-top:8px; color:var(--text);">${currentUser.mobile || 'N/A'}</p>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:12px;">
                    <button class="w-btn login-btn" onclick="togglePassReset()" style="width:100%; padding:18px; border-radius:18px; border:none; background:var(--primary); color:white; font-weight:800; cursor:pointer;">
                        Change Password <i class="fas fa-key"></i>
                    </button>

                    <button class="p-btn-alt" onclick="handleLogout()" style="width:100%; padding:18px; border-radius:18px; border:1px solid var(--border); background:var(--bg); color:var(--text); font-weight:800; cursor:pointer;">
                        Log Out <i class="fas fa-sign-out-alt"></i>
                    </button>

                    <button class="p-btn-alt" onclick="confirmDeleteAccount()" style="width:100%; padding:18px; border-radius:18px; border:1px solid rgba(239, 68, 68, 0.2); background:rgba(239, 68, 68, 0.05); color:#ef4444; font-weight:800; cursor:pointer; margin-top:10px;">
                        Delete Account <i class="fas fa-trash-alt"></i>
                    </button>
                </div>

                <div id="passResetFields" class="hidden" style="margin-top:25px; padding:25px; background:var(--bg); border-radius:20px; border:1px solid var(--border); display:flex; flex-direction:column; gap:15px;">
                    <input type="password" id="oldPassInput" placeholder="Current Password" style="width:100%; padding:15px; border-radius:12px; border:1px solid var(--border); background:var(--card); color:var(--text);">
                    <input type="password" id="finalNewPass" placeholder="New Password" style="width:100%; padding:15px; border-radius:12px; border:1px solid var(--border); background:var(--card); color:var(--text);">
                    <button class="w-btn login-btn" onclick="processPasswordChange()" style="padding:15px; border-radius:12px; background:var(--primary); border:none; color:white; font-weight:800; cursor:pointer;">Update Password</button>
                </div>
            </div>
        </div>
    `;
}

function toggleExpand(e, id) { e.stopPropagation(); tasks = tasks.map(t => t.id === id ? { ...t, isExpanded: !t.isExpanded } : t); saveToLocal(); renderTasks(); }

// 🔥 UPDATED TOGGLE WITH BI-DIRECTIONAL COMPLETION 🔥
function toggleTask(e, id) {
    e.stopPropagation();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const t = tasks[taskIndex];
    const isNowCompleted = !t.completed;
    const todayISO = getLocalISO(new Date());

    // 🔥 LOGIC FIX: Handle Recurring Instances
    if (isNowCompleted && t.repeat === 'custom_days' && t.repeatDays && t.repeatDays.length > 0) {
        
        let checkDate = parseLocalDate(t.deadline);
        checkDate.setDate(checkDate.getDate() + 1); // Start looking from tomorrow

        let foundNext = false;
        for(let i = 0; i < 7; i++) {
            if(t.repeatDays.includes(checkDate.getDay())) {
                const nextDateISO = getLocalISO(checkDate);
                
                // Create the NEW future instance as PENDING
                const nextTask = {
                    ...t,
                    id: Date.now() + Math.random(),
                    deadline: nextDateISO,
                    completed: false,
                    completedDate: null,
                    updatedAt: Date.now()
                };
                tasks.push(nextTask);
                foundNext = true;
                break;
            }
            checkDate.setDate(checkDate.getDate() + 1);
        }

        // The current instance is now "finished" and should stop repeating
        t.repeat = 'none';
    }

    // Standard toggle for the current task
    t.completed = isNowCompleted;
    t.completedDate = isNowCompleted ? todayISO : null;
    t.updatedAt = Date.now();

    saveToLocal();
    renderTasks();
    
    // Refresh calendar if open
    const calSec = document.getElementById("calendarSection");
    if(calSec && !calSec.classList.contains("hidden")) renderCal();
    
    showToast(isNowCompleted ? "Completed! 🎉" : "Updated", "info");
}

function openTaskModal(id) {
    activeModalTaskId = id;
    const t = tasks.find(x => x.id === id);

    if(!t) return;

    // 1. Basic Text Fields Fill
    document.getElementById("modalTitle").innerText = t.title;
    document.getElementById("modalDesc").innerText = t.desc;
    document.getElementById("modalCreatedDate").innerText = t.createdDate || "N/A";
    document.getElementById("modalProject").innerText = (t.project || 'personal').toUpperCase();

    // 2. 🔥 RE-INTEGRATED: DATE, TIME & REMINDER LOGIC (12-Hour)
    let offsetText = "";
    if (t.reminderOffset === "custom" && t.customReminder) {
        const d = new Date(t.customReminder);
        if (!isNaN(d)) {
            const timeRaw = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            offsetText = `Custom: ${d.toLocaleDateString()} ${format12Hour(timeRaw)}`;
        } else {
            offsetText = "Custom: Invalid Date";
        }
    } else {
        const offsetVal = parseInt(t.reminderOffset || "0");
        offsetText = offsetVal === 0 ? "At time of task" : `${offsetVal} mins before`;
    }
    const timeDisplay = t.time ? `at ${format12Hour(t.time)}` : "(No time set)";
    offsetText = "";

    if (t.reminderOffset === "none" || !t.reminderOffset) {
        offsetText = "No reminder";
    } else if (t.reminderOffset === "custom" && t.customReminder) {
        const d = new Date(t.customReminder);
        offsetText = `Reminder: ${d.toLocaleDateString()} ${format12Hour(`${d.getHours()}:${d.getMinutes()}`)}`;
    } else {
        offsetText = `Reminder: ${t.reminderOffset} mins before`;
    }

    document.getElementById("modalDate").innerText = `${t.deadline} ${timeDisplay} | ${offsetText}`;

    // 3. Status Badge & Priority Setup
    const badge = document.getElementById("modalStatusBadge");
    badge.innerText = t.completed ? "COMPLETED" : "PENDING";
    badge.className = t.completed ? "status-pill status-completed" : "status-pill status-pending";
    document.getElementById("modalPriorityCircle").style.background = `var(--${t.priority})`;

    // 4. 🔥 RECURRING TAG UPDATE (Modal mein bhi dikhega)
    const repeatText = (t.repeat || 'none').toUpperCase();
    const repeatEl = document.getElementById("modalRepeat");
    repeatEl.innerText = repeatText;
    repeatEl.style.color = repeatText === 'NONE' ? "var(--text-dim)" : "var(--primary)";
    repeatEl.style.borderColor = repeatText === 'NONE' ? "var(--border)" : "var(--primary)";

    // 5. 🔥 BUTTONS LOGIC 🔥
    
    // Normal Buttons (Edit & Delete)
    document.getElementById("modalEditBtn").onclick = () => editTask(t.id);
    document.getElementById("modalDeleteBtn").onclick = () => { 
        tasks = tasks.filter(x => x.id !== id && x.parentId !== id); 
        saveToLocal(); closeModal('taskModal'); renderTasks(); renderCal(); 
        showToast("Deleted", "delete");
    };

    // 🔥 ARCHIVE / RESTORE TOGGLE (Manual Control)
    const archiveBtn = document.getElementById("modalArchiveBtn");
    const restoreBtn = document.getElementById("modalRestoreBtn");
    if (t.isArchived) {
        archiveBtn.style.display = "none";
        restoreBtn.style.display = "block";
        restoreBtn.onclick = () => restoreTask(t.id);
    } else {
        archiveBtn.style.display = "block";
        restoreBtn.style.display = "none";
        archiveBtn.onclick = () => archiveTask(t.id);
    }

    // 🔥 MERGE BACK (REVERT BREAKDOWN)
    const revertBtn = document.getElementById("modalRevertBtn");
    if (!t.completed && t.hasSubtasks) {
        revertBtn.style.display = "block";
        revertBtn.onclick = () => revertBreakdown(t.id);
    } else {
        revertBtn.style.display = "none";
    }

    // BREAKDOWN BUTTON (Hide if archived or already broken down)
    const breakBtn = document.getElementById("modalBreakdownBtn");
    if (t.completed || t.hasSubtasks || t.parentId || t.isArchived) { 
        breakBtn.style.display = "none"; 
    } else { 
        breakBtn.style.display = "block"; 
        breakBtn.onclick = () => executeBreakdown(t.id); 
    }

    // FOCUS BUTTON (Hide if archived or broken down)
    const focusBtn = document.getElementById("modalFocusBtn");
    if (t.completed || t.hasSubtasks || t.isArchived) { 
        focusBtn.style.display = "none"; 
    } else { 
        focusBtn.style.display = "block"; 
        focusBtn.onclick = () => { closeModal('taskModal'); startZenMode(t.id); }; 
    }

    document.getElementById("taskModal").classList.remove("hidden");

    
    const stopRepeatBtn = document.getElementById("modalStopRepeatBtn");
    if (t.repeat && t.repeat !== 'none' && !t.completed && !t.isArchived) {
        stopRepeatBtn.style.display = "block";
        stopRepeatBtn.onclick = () => stopRepeating(t.id);
    } else {
        stopRepeatBtn.style.display = "none";
    }
    renderModalSubtasks(id);
}

function executeBreakdown(id) {
    const parentTask = tasks.find(t => t.id === id); if(!parentTask) return;
    parentTask.hasSubtasks = true; parentTask.isExpanded = true; parentTask.updatedAt = Date.now();
    const baseId = Date.now(), subTasks = [
        { ...parentTask, id: baseId + 1, parentId: id, hasSubtasks: false, title: `Phase 1: Prep`, desc: `Prep for: ${parentTask.desc}`, priority: "low", updatedAt: Date.now() },
        { ...parentTask, id: baseId + 2, parentId: id, hasSubtasks: false, title: `Phase 2: Action`, desc: `Action for: ${parentTask.desc}`, priority: parentTask.priority, updatedAt: Date.now() },
        { ...parentTask, id: baseId + 3, parentId: id, hasSubtasks: false, title: `Phase 3: Review`, desc: `Review for: ${parentTask.desc}`, priority: "medium", updatedAt: Date.now() }
    ];
    tasks.push(...subTasks); saveToLocal(); closeModal('taskModal'); renderTasks();
    if(document.getElementById("calendarSection") && !document.getElementById("calendarSection").classList.contains("hidden")) renderCal();
    showToast("Broken down!", "success");
}

function openDaySummary(dateStr) {
    const dayTasks = getTasksForDate(dateStr), list = document.getElementById("summaryList");
    document.getElementById("summaryDateTitle").innerText = "Schedule: " + dateStr;
    list.innerHTML = dayTasks.length ? "" : "<p style='opacity:0.5; text-align:center;'>No tasks for this day.</p>";
    dayTasks.forEach(t => {
        const item = document.createElement("div"); 
        item.className = "task"; 
        item.onclick = () => { closeModal('daySummaryModal'); openTaskModal(t.id); };

        // 🔥 Recurring Indicator Logic
        const isRecurring = t.repeat && t.repeat !== 'none' && t.deadline !== dateStr;
        const repeatIcon = isRecurring ? `<i class="fas fa-redo" style="font-size: 0.7rem; color: var(--primary); margin-left: 5px;"></i>` : '';

        item.innerHTML = `
            <div style="width:5px; height:35px; border-radius:10px; background:var(--${t.priority}); flex-shrink: 0;"></div>
            <div style="margin-left:15px; overflow: hidden;">
                <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">
                    ${t.title} ${repeatIcon}
                </strong>
                ${isRecurring ? '<span style="font-size: 0.65rem; color: var(--text-dim); font-weight: 800;">RECURRING INSTANCE</span>' : ''}
            </div>`;
        list.appendChild(item);
    });

    document.getElementById("daySummaryModal").classList.remove("hidden");
}

// todo.js: Toggle Repeat Settings
const repeatSelect = document.getElementById("repeat");
if (repeatSelect) {
    repeatSelect.addEventListener("change", function() {
        const settings = document.getElementById("repeatEndSettings");
        if (this.value !== "none") settings.classList.remove("hidden");
        else settings.classList.add("hidden");
    });
}



function editTask(id) {
    const t = tasks.find(x => x.id === id);
    closeModal('taskModal'); document.querySelector('[data-section="add"]').click();
    document.getElementById("title").value = t.title; document.getElementById("desc").value = t.desc; document.getElementById("deadline").value = t.deadline; document.getElementById("taskTime").value = t.time || "";; 
    const remSelect = document.getElementById("reminderOffset"); if (remSelect) remSelect.value = t.reminderOffset || "0"; 
    const customInput = document.getElementById("customReminder");
    if (customInput) {
        if (t.reminderOffset === "custom") { customInput.classList.remove("hidden"); customInput.value = t.customReminder || ""; }
        else { customInput.classList.add("hidden"); customInput.value = ""; }
    }
    document.getElementById("priority").value = t.priority; document.getElementById("project").value = t.project || "personal"; document.getElementById("repeat").value = t.repeat || "none"; 
    editModeId = t.id;
    document.querySelectorAll(".day-pill").forEach(pill => {
        const day = parseInt(pill.dataset.day);
        pill.classList.toggle("active", t.repeatDays && t.repeatDays.includes(day));
    });
    if(t.repeat === "custom_days") document.getElementById("dayPickerContainer").classList.remove("hidden");
    // Load existing subtasks into the staging area
    tempSubtasks = tasks.filter(t => t.parentId === id).map(t => ({...t})); 
    renderTempSubtasks();
}

function resetForm() { 
    document.getElementById("title").value = ""; document.getElementById("desc").value = ""; document.getElementById("deadline").value = ""; document.getElementById("taskTime").value = ""; 
    if (remOffset) remOffset.value = "none";
    const customInput = document.getElementById("customReminder"); if (customInput) { customInput.classList.add("hidden"); customInput.value = ""; }
    document.getElementById("project").value = "personal"; document.getElementById("repeat").value = "none"; editModeId = null; 
    document.querySelectorAll(".day-pill").forEach(p => p.classList.remove("active"));
document.getElementById("dayPickerContainer").classList.add("hidden");
    tempSubtasks = []; // Clear staging array
    renderTempSubtasks(); // Clear UI
}

function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

// --- 🔥 SUBTASK CREATION LOGIC (ADD SECTION) ---
let tempSubtasks = [];

document.getElementById("addTempSubtaskBtn").onclick = () => {
    const input = document.getElementById("createSubtaskInput");
    const title = input.value.trim();
    if (!title) return;
    
    // Push to temporary staging array
    tempSubtasks.push({
        id: Date.now() + Math.random(), // Temporary ID
        title: title,
        completed: false
    });
    
    input.value = ""; // Clear input
    renderTempSubtasks();
};

function renderTempSubtasks() {
    const container = document.getElementById("createSubtaskList");
    container.innerHTML = "";
    
    tempSubtasks.forEach(st => {
        const div = document.createElement("div");
        div.style = "display: flex; justify-content: space-between; align-items: center; background: var(--bg); padding: 10px 15px; border-radius: 10px; border: 1px solid var(--border);";
        div.innerHTML = `
            <span style="font-weight: 600; font-size: 0.9rem;">
                <i class="fas fa-level-up-alt fa-rotate-90" style="color: var(--text-dim); margin-right: 8px;"></i> 
                ${st.title}
            </span>
            <button type="button" onclick="removeTempSubtask(${st.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

function removeTempSubtask(id) {
    tempSubtasks = tempSubtasks.filter(st => st.id !== id);
    renderTempSubtasks();
}

document.getElementById("saveBtn").onclick = () => {
    const title = document.getElementById("title").value; if(!title) return showToast("Title required!", "error");
    const taskTime = document.getElementById("taskTime").value || null;
    const remOffsetEl = document.getElementById("reminderOffset");
    const reminderOffset = remOffsetEl ? remOffsetEl.value : "0";
    const customRemEl = document.getElementById("customReminder");
    const customReminder = customRemEl ? customRemEl.value : "";
    const now = Date.now();
    const selectedDays = [];
    
    document.querySelectorAll(".day-pill.active").forEach(p => {
        selectedDays.push(parseInt(p.dataset.day));
    });

    const hasSubtasks = tempSubtasks.length > 0;
    let parentId = editModeId ? editModeId : now; // Determine the Parent ID

    if(editModeId) {
        // 1. Update the Parent Task
        tasks = tasks.map(t => t.id === editModeId ? {...t, title, desc: document.getElementById("desc").value, deadline: document.getElementById("deadline").value, time: taskTime, reminderOffset, customReminder, priority: document.getElementById("priority").value, project: document.getElementById("project").value, repeat: document.getElementById("repeat").value, repeatDays: selectedDays, notified: false, hasSubtasks: hasSubtasks, updatedAt: now} : t);
        
        // 2. Remove old subtasks from the main array (we will replace them with the staged ones)
        tasks = tasks.filter(t => t.parentId !== editModeId);
        
        showToast("Task Updated", "success");
    } else {
        // 1. Create New Parent Task
        tasks.push({ id: parentId, title, desc: document.getElementById("desc").value, deadline: document.getElementById("deadline").value, time: taskTime, reminderOffset, customReminder, priority: document.getElementById("priority").value, project: document.getElementById("project").value, repeat: document.getElementById("repeat").value, repeatDays: selectedDays, createdDate: getLocalISO(new Date()), updatedAt: now, completed: false, completedDate: null, notified: false, isArchived: false, hasSubtasks: hasSubtasks });
        
        showToast("Task Created", "success");
    }

    // 3. Push all staged subtasks into the main tasks array and link them to the parent
    tempSubtasks.forEach(st => {
        tasks.push({
            ...st,
            id: Date.now() + Math.random(), // Ensure unique ID
            parentId: parentId,
            priority: document.getElementById("priority").value, // Inherit parent priority
            project: document.getElementById("project").value,   // Inherit parent project
            deadline: document.getElementById("deadline").value, // Inherit parent deadline
            time: taskTime,
            isArchived: false,
            updatedAt: Date.now()
        });
    });

    saveToLocal(); 
    resetForm(); 
    document.querySelector('[data-section="all"]').click();
};

document.getElementById("themeToggle").onclick = () => { document.body.classList.toggle("dark"); const isDark = document.body.classList.contains("dark"); localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light"); 
    document.getElementById("themeLabel").innerText = isDark ? "Light Mode" : "Dark Mode";
    document.getElementById("themeToggle").querySelector("i").className = isDark ? "fas fa-sun" : "fas fa-moon";
    
    showToast(`${isDark ? 'Dark' : 'Light'} Mode Activated`, "info");
};

function checkOverdueTasks() {
    const todayISO = getLocalISO(new Date());
    const overdueTasks = tasks.filter(t => 
        !t.completed && 
        !t.parentId && 
        t.deadline && 
        t.deadline < todayISO &&
        !t.isArchived
    );

    if (overdueTasks.length > 0) {
        const list = document.getElementById("triageList");
        const modal = document.getElementById("triageModal");
        
        if (list && modal) {
            list.innerHTML = "";
            overdueTasks.forEach(t => {
                const item = document.createElement("div");
                item.className = "triage-item";
                item.innerHTML = `
                    <div class="triage-info">
                        <div class="triage-title" style="color:var(--text);">${t.title}</div>
                        <div class="triage-date" style="color:var(--high);">Due: ${t.deadline}</div>
                    </div>
                    <select class="triage-action" data-id="${t.id}" style="background:var(--card); color:var(--text); border:1px solid var(--border);">
                        <option value="today">Push to Today</option>
                        <option value="next_week">Defer 1 Week</option>
                        <option value="delete">Drop / Delete</option>
                        <option value="ignore">Ignore</option>
                    </select>`;
                list.appendChild(item);
            });
            modal.classList.remove("hidden");
        }
    }
}

// Global Trigger for Refresh
setTimeout(checkOverdueTasks, 500);

const triageBtn = document.getElementById("applyTriageBtn");
if (triageBtn) {
    triageBtn.onclick = () => {
        const today = new Date(), nextWeek = new Date(); nextWeek.setDate(today.getDate() + 7);
        const todayISO = getLocalISO(today), nextWeekISO = getLocalISO(nextWeek);
        let droppedCount = 0, updatedCount = 0, now = Date.now();
        document.querySelectorAll(".triage-action").forEach(select => {
            const id = parseInt(select.dataset.id), action = select.value;
            if (action === "today") { tasks = tasks.map(t => (t.id === id || t.parentId === id) ? { ...t, deadline: todayISO, updatedAt: now } : t); updatedCount++; }
            else if (action === "next_week") { tasks = tasks.map(t => (t.id === id || t.parentId === id) ? { ...t, deadline: nextWeekISO, updatedAt: now } : t); updatedCount++; }
            else if (action === "delete") { tasks = tasks.filter(t => t.id !== id && t.parentId !== id); droppedCount++; }
        });
        saveToLocal(); renderTasks(); if(document.getElementById("calendarSection") && !document.getElementById("calendarSection").classList.contains("hidden")) renderCal();
        closeModal('triageModal'); if (updatedCount > 0 || droppedCount > 0) showToast(`Complete: ${updatedCount} moved, ${droppedCount} dropped.`);
    };
}

function revertBreakdown(id) {
    tasks = tasks.filter(t => t.parentId !== id);
    tasks = tasks.map(t => t.id === id ? { ...t, hasSubtasks: false, isExpanded: false, updatedAt: Date.now() } : t);
    saveToLocal(); closeModal('taskModal'); renderTasks(); showToast("Merged back!", "info");
}

renderTasks();
setTimeout(checkOverdueTasks, 500);

// 🔥 THEME DATABASE
const themeList = [
    { id: 'pro-blue', name: 'Corporate Blue', color: '#2563eb' },
    { id: 'cream', name: 'Modern Cream', color: '#d97706' },
    { id: 'lavender', name: 'Soft Lavender', color: '#a855f7' },
    { id: 'pastel', name: 'Pastel Paradise', color: '#f472b6' },
    { id: 'sage', name: 'Sage Forest', color: '#10b981' },
];


// 1. Initial Load: Apply saved theme
const savedTheme = localStorage.getItem("app-theme") || "default";
document.body.setAttribute("data-theme", savedTheme);

// 2. Open Modal Logic
document.getElementById("openThemesBtn").onclick = () => {
    renderThemes();
    document.getElementById("themesModal").classList.remove("hidden");
};

// 3. Render Themes in Modal
function renderThemes() {
    const grid = document.getElementById("themesGrid");
    grid.innerHTML = "";
    const activeTheme = document.body.getAttribute("data-theme");

    themeList.forEach(theme => {
        const opt = document.createElement("div");
        opt.className = `theme-opt ${activeTheme === theme.id ? 'active' : ''}`;
        opt.innerHTML = `
            <div style="width:30px; height:30px; border-radius:50%; background:${theme.color}; margin: 0 auto 10px;"></div>
            <span style="font-size: 0.75rem; font-weight: 800;">${theme.name}</span>
        `;
        opt.onclick = () => {
            document.body.setAttribute("data-theme", theme.id);
            localStorage.setItem("app-theme", theme.id);
            closeModal('themesModal');
            showToast(`${theme.name} Applied!`, "info");
        };
        grid.appendChild(opt);
    });
}

function archiveTask(id) {
    tasks = tasks.map(t => (t.id === id || t.parentId === id) ? { ...t, isArchived: true } : t);
    saveToLocal();
    closeModal('taskModal');
    renderTasks();
    showToast("Moved to Archive", "info");
}

function restoreTask(id) {
    tasks = tasks.map(t => (t.id === id || t.parentId === id) ? { ...t, isArchived: false } : t);
    saveToLocal();
    closeModal('taskModal');
    renderTasks();
    showToast("Restored to active list", "success");
}

// 🔥 ENTER APP LOGIC 🔥
// 🔥 SMOOTH ENTRY LOGIC 🔥
function enterApp() {
    const welcome = document.getElementById("welcomePage");
    const authCont = document.getElementById("authContainer");

    if (welcome) {
        welcome.classList.add("welcome-fade-out");
        
        setTimeout(() => {
            welcome.style.display = "none";
            if(authCont) authCont.classList.add("hidden");

            // 1. Title Update
            const mainTitle = document.getElementById("mainTitle");
            if(mainTitle && currentUser) {
                mainTitle.innerHTML = `Welcome back, ${currentUser.name} ⚡`;
            }

            // 2. Render UI
            renderTasks();

            // 3. 🔥 LOGIN HOTI HI TRIAGE CHECK KARO!
            console.log("Login successful, checking triage...");
            checkOverdueTasks();

            showToast(`Access Granted. Welcome, ${currentUser.name}!`, "success");
        }, 1000);
    }
}

// 🔥 AUTHENTICATION SYSTEM FUNCTIONS 🔥

// 1. Welcome aur Auth boxes ke beech toggle karne ke liye
/* --- 🔥 UPDATED AUTH LOGIC FOR FULL-PAGE DESIGN --- */

// 1. Welcome page aur Auth pages ke beech toggle
// 🔥 UPDATED showAuth function
function showAuth(type) {
    const hero = document.getElementById("heroContent");
    const authPage = document.getElementById("authPage");
    if(hero) hero.classList.add("hidden");
    if(authPage) authPage.classList.remove("hidden");
    
    // Sab views ko hide/show karo type ke hisab se
    document.getElementById("loginPage").classList.toggle("hidden", type !== 'login');
    document.getElementById("signupPage").classList.toggle("hidden", type !== 'signup');
    
    const forgotPage = document.getElementById("forgotPage");
    if(forgotPage) {
        forgotPage.classList.toggle("hidden", type !== 'forgot');
        if(type === 'forgot') {
            document.getElementById("resetStepText").innerText = "Provide your account identifier";
            document.getElementById("resetInputGroup").classList.remove("hidden");
            document.getElementById("otpFields").classList.add("hidden");
            document.getElementById("resetActionBtn").innerText = "Send Verification Code";
            document.getElementById("resetActionBtn").onclick = sendResetCode;
        }
    }
}

function showWelcome() {
    // Auth page chhupao aur Hero wapas dikhao
    const authPage = document.getElementById("authPage");
    const hero = document.getElementById("heroContent");
    if(authPage) authPage.classList.add("hidden");
    if(hero) hero.classList.remove("hidden");
}

// 2. Signup Logic: 6 Fields sync
function handleSignup() {
    const name = document.getElementById("regName").value.trim();
    const age = document.getElementById("regAge").value.trim();
    const gender = document.getElementById("regGender").value;
    const mobile = document.getElementById("regMobile").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value.trim();

    // Validation Pop-ups in English
    if(!name || !age || !gender || !pass) {
        return showToast("⚠️ All fields are mandatory!", "error");
    }

    if(!mobile && !email) {
        return showToast("⚠️ Please provide either Email or Mobile Number!", "error");
    }

    const existing = users.find(u => (email && u.email === email) || (mobile && u.mobile === mobile));
    if(existing) {
        return showToast("ℹ️ Account already exists! Please Log In.", "info");
    }

    // Success Storage
    users.push({ id: Date.now(), name, age, gender, mobile, email, pass });
    localStorage.setItem("tf_users", JSON.stringify(users));
    
    showToast(`✅ Welcome, ${name}! Account created successfully.`, "success");
    setTimeout(() => showAuth('login'), 1500);
}

function handleLogin() {
    const id = document.getElementById("loginId").value.trim();
    const pass = document.getElementById("loginPass").value.trim();

    if(!id || !pass) {
        return showToast("⚠️ Please enter both Identifier and Password!", "error");
    }

    const user = users.find(u => u.email === id || u.mobile === id);

    // Error Pop-ups in English
    if(!user) {
        return showToast("❌ No account found with this ID!", "error");
    }

    if(user.pass !== pass) {
        return showToast("🚫 Incorrect Password! Please try again.", "error");
    }

    // Success Login
    currentUser = user;
    localStorage.setItem("tf_current_user", JSON.stringify(user));
    showToast(`⚡ Access Granted! Welcome back, ${user.name}.`, "success");
    enterApp();
}

// Full Entry Animation
function enterApp() {
    const welcome = document.getElementById("welcomePage");
    welcome.classList.add("welcome-fade-out");
    
    setTimeout(() => {
        welcome.style.display = "none";
        // Header title ko dynamic welcome message mein badlo
        const mainTitle = document.getElementById("mainTitle");
        if(mainTitle && currentUser) mainTitle.innerHTML = `Welcome back, ${currentUser.name} ⚡`;
        showToast(`Authorization Complete. Access Granted.`, "success");
    }, 1000);
}

function sendResetCode() {
    const id = document.getElementById("resetIdentifier").value.trim();
    const user = users.find(u => u.email === id || u.mobile === id);
    if(!user) return showToast("❌ User not found!", "error");

    generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    alert(`DEBUG: Your verification code is ${generatedOTP}`); 
    
    showToast("✅ Verification code sent successfully!", "success");
    
    document.getElementById("resetStepText").innerText = "Enter the code and your new password";
    document.getElementById("resetInputGroup").classList.add("hidden");
    document.getElementById("otpFields").classList.remove("hidden");
    document.getElementById("resetActionBtn").innerText = "Update Password";
    document.getElementById("resetActionBtn").onclick = handlePasswordUpdate;
}

function handlePasswordUpdate() {
    const code = document.getElementById("verificationCode").value.trim();
    const newPass = document.getElementById("newPass").value.trim();
    const id = document.getElementById("resetIdentifier").value.trim();

    if(code !== generatedOTP) return showToast("❌ Invalid Verification Code!", "error");
    if(newPass.length < 6) return showToast("⚠️ Password must be at least 6 characters!", "error");

    users = users.map(u => (u.email === id || u.mobile === id) ? { ...u, pass: newPass } : u);
    localStorage.setItem("tf_users", JSON.stringify(users));
    
    showToast("✅ Password updated successfully!", "success");
    showAuth('login');
}
function showToast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    if(!container) return; // Guard clause

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Aesthetic icons
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-shield-alt' : 'fa-info-circle';
                 
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    // Auto-dismiss logic
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// 🔥 PROFILE & SECURITY LOGIC 🔥

function openProfileModal() {
    if(!currentUser) return showToast("Please log in first!", "error");
    
    // Set User Data in UI
    document.getElementById("profName").innerText = currentUser.name;
    document.getElementById("profEmail").innerText = currentUser.email || "No Email";
    document.getElementById("profAge").innerText = currentUser.age;
    document.getElementById("profMobile").innerText = currentUser.mobile || "N/A";
    document.getElementById("profGender").innerText = currentUser.gender;
    
    // Dynamic Avatar
    document.getElementById("displayUserPic").src = `https://ui-avatars.com/api/?name=${currentUser.name}&background=a855f7&color=fff`;
    
    document.getElementById("profileModal").classList.remove("hidden");
}

function togglePassReset() {
    document.getElementById("passResetFields").classList.toggle("hidden");
}

function processPasswordChange() {
    const oldPass = document.getElementById("oldPassInput").value;
    const code = document.getElementById("resetCodeInput").value;
    const newPass = document.getElementById("finalNewPass").value;

    // Logic: Either Old Pass matches OR Verification Code matches
    const isOldPassValid = oldPass && oldPass === currentUser.pass;
    const isCodeValid = code && code === generatedOTP;

    if (!isOldPassValid && !isCodeValid) {
        return showToast("Incorrect Old Password or Verification Code!", "error");
    }

    if (newPass.length < 4) return showToast("Password too short!", "error");

    // Update User
    users = users.map(u => u.id === currentUser.id ? { ...u, pass: newPass } : u);
    currentUser.pass = newPass;
    
    localStorage.setItem("tf_users", JSON.stringify(users));
    localStorage.setItem("tf_current_user", JSON.stringify(currentUser));
    
    showToast("Password updated successfully!", "success");
    togglePassReset();
}

function confirmDeleteAccount() {
    const confirmPass = prompt("WARNING: This will permanently delete your account. Enter your password to confirm:");
    
    if (confirmPass === currentUser.pass) {
        // Remove from users list
        users = users.filter(u => u.id !== currentUser.id);
        localStorage.setItem("tf_users", JSON.stringify(users));
        
        showToast("Account deleted. We're sad to see you go.", "info");
        handleLogout(); // Exit to welcome screen
    } else if (confirmPass !== null) {
        showToast("Incorrect password! Account deletion cancelled.", "error");
    }
}

function handleLogout() {
    // Session clear karo
    localStorage.removeItem("tf_current_user");
    currentUser = null;

    // Welcome Page dikhao
    const welcome = document.getElementById("welcomePage");
    if (welcome) {
        welcome.style.display = "flex";
        welcome.classList.remove("welcome-fade-out");
        showWelcome(); // Auth boxes hide karke main buttons dikhayega
    }

    showToast("Logged out successfully.", "info");
}

// todo.js: Manual Repeat Turn-Off
function stopRepeating(id) {
    tasks = tasks.map(t => (t.id === id || t.parentId === id) ? { ...t, repeat: 'none' } : t);
    saveToLocal();
    closeModal('taskModal');
    renderTasks();
    showToast("Repetition turned off for this task.", "info");
}

// Handle showing the picker
const repeatEl = document.getElementById("repeat");
if(repeatEl) {
    repeatEl.addEventListener("change", function() {
        const picker = document.getElementById("dayPickerContainer");
        if(this.value === "custom_days") picker.classList.remove("hidden");
        else picker.classList.add("hidden");
    });
}

// Handle clicking the pills
document.querySelectorAll(".day-pill").forEach(pill => {
    pill.onclick = (e) => {
        e.preventDefault(); // Stop form submission
        pill.classList.toggle("active");
    };
});

function toggleSelectionMode() {
    // 1. Flip the state
    isSelectionMode = !isSelectionMode;

    // 2. Grab elements (Using flexible checks to avoid errors)
    const btn = document.getElementById("selectionModeBtn");
    const taskSection = document.getElementById("taskSection");
    const body = document.body;

    if (!btn || !taskSection) return;

    // 3. UI Updates
    if (isSelectionMode) {
        body.classList.add("selection-mode-active"); // For the Sidebar CSS
        taskSection.classList.add("selection-mode"); // For the Task CSS
        btn.innerHTML = `<i class="fas fa-times"></i> <span>Exit Management</span>`;
        showToast("Management Mode: Active", "info");
    } else {
        body.classList.remove("selection-mode-active");
        taskSection.classList.remove("selection-mode");
        btn.innerHTML = `<i class="fas fa-tasks"></i> <span>Management Mode</span>`;
        clearSelection(); // Resets your selected IDs
    }

    renderTasks(); // Refresh the list to show checkboxes
}

function toggleTaskSelection(id) {
    if (selectedTaskIds.includes(id)) {
        selectedTaskIds = selectedTaskIds.filter(tid => tid !== id);
    } else {
        selectedTaskIds.push(id);
    }
    updateBulkUI();
    renderTasks(); // Refresh to show highlight/check
}

function updateBulkUI() {
    const bar = document.getElementById("bulkActionBar");
    const countEl = document.getElementById("selectedCount");
    const archiveBtn = document.querySelector(".bulk-btn.archive"); // Target the archive button

    if (selectedTaskIds.length > 0 && isSelectionMode) {
        bar.classList.remove("hidden");
        countEl.innerText = selectedTaskIds.length;

        // ✅ THE CONTEXT FIX
        if (currentSec === "archived") {
            archiveBtn.innerHTML = `<i class="fas fa-box-open"></i> Unarchive`;
            archiveBtn.setAttribute("onclick", "applyBulkAction('unarchive')");
        } else {
            archiveBtn.innerHTML = `<i class="fas fa-archive"></i> Archive`;
            archiveBtn.setAttribute("onclick", "applyBulkAction('archive')");
        }
    } else {
        bar.classList.add("hidden");
    }
}

function toggleSelectAll() {
    // 1. Get the list of tasks currently visible in the current section
    const visibleTasks = tasks.filter(t => {
        if (t.parentId) return false; // Ignore subtasks
        
        const searchMatch = t.title.toLowerCase().includes(searchQuery) || 
                           (t.desc && t.desc.toLowerCase().includes(searchQuery));

        // Use the same logic as renderTasks to identify what's on screen
        let secMatch = false;
        if (currentSec === "all") secMatch = !t.isArchived;
        else if (currentSec === "archived") secMatch = t.isArchived;
        else if (currentSec === "pending") secMatch = !t.completed && !t.isArchived;
        else if (currentSec === "completed") secMatch = t.completed && !t.isArchived;
        else secMatch = (t.project || "personal") === currentSec && !t.isArchived;

        return secMatch && searchMatch;
    });

    const visibleIds = visibleTasks.map(t => t.id);

    // 2. Logic: If everything visible is already selected, clear it. 
    // Otherwise, select everything that is visible.
    const allVisibleSelected = visibleIds.every(id => selectedTaskIds.includes(id));

    if (allVisibleSelected) {
        // Remove only the visible ones from the selection
        selectedTaskIds = selectedTaskIds.filter(id => !visibleIds.includes(id));
    } else {
        // Add all visible IDs, avoiding duplicates
        selectedTaskIds = [...new Set([...selectedTaskIds, ...visibleIds])];
    }

    renderTasks();
    updateBulkUI();
}

function clearSelection() {
    selectedTaskIds = [];
    renderTasks();
    updateBulkUI();
}

function applyBulkAction(action) {
    if (selectedTaskIds.length === 0) return;

    if (action === 'delete') {
        // 🔥 THE FIX: Use .filter to permanently remove the tasks and their subtasks
        tasks = tasks.filter(t => !selectedTaskIds.includes(t.id) && !selectedTaskIds.includes(t.parentId));
        showToast("Tasks deleted successfully!", "error"); // 'error' triggers your red toast
    } else {
        // Handle Archive and Unarchive
        tasks = tasks.map(t => {
            if (selectedTaskIds.includes(t.id) || selectedTaskIds.includes(t.parentId)) {
                if (action === 'archive') {
                    t.isArchived = true;
                } else if (action === 'unarchive') {
                    t.isArchived = false; 
                }
            }
            return t;
        });
        const message = action === 'unarchive' ? "Tasks restored!" : "Tasks archived!";
        showToast(message, "success");
    }

    saveToLocal();
    clearSelection(); 
    
    // Auto-exit management mode after applying an action for a smoother feel
    if (isSelectionMode) toggleSelectionMode(); 
    
    renderTasks();
}

function addManualSubtask() {
    // Look for the input specifically inside the modal to avoid duplicate ID confusion
    const modal = document.getElementById("taskModal");
    const input = modal.querySelector("#newSubtaskTitle"); 
    
    if (!input) return;
    const title = input.value.trim();

    if (!title || !activeModalTaskId) return;

    const newST = {
        id: Date.now(),
        parentId: activeModalTaskId,
        title: title,
        completed: false
    };

    tasks.push(newST);
    saveToLocal();
    
    input.value = ""; // Clear the input after adding
    renderModalSubtasks(activeModalTaskId);
    renderTasks();
}

function renderModalSubtasks(parentId) {
    // 1. Find the container in your modal where subtasks should live
    // Make sure you have an element with this ID in your modal HTML template
    const subtaskContainer = document.getElementById("modalSubtaskList");
    if (!subtaskContainer) return;

    // 2. Clear the old list
    subtaskContainer.innerHTML = "";

    // 3. Filter the main tasks array for children of this parent
    const subtasks = tasks.filter(t => t.parentId === parentId);

    if (subtasks.length === 0) {
        subtaskContainer.innerHTML = `<p style="color: var(--text-dim); font-size: 0.85rem; padding: 10px;">No subtasks yet.</p>`;
        return;
    }

    // 4. Draw each subtask
    subtasks.forEach(st => {
        const div = document.createElement("div");
        div.className = `modal-subtask-item ${st.completed ? 'completed' : ''}`;
        div.style = "display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg); border-radius: 12px; margin-bottom: 8px; border: 1px solid var(--border);";

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="check-circle" onclick="toggleTask(event, ${st.id}); renderModalSubtasks(${parentId});">
                    ${st.completed ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <span style="${st.completed ? 'text-decoration: line-through; color: var(--text-dim);' : ''} font-weight: 600;">
                    ${st.title}
                </span>
            </div>
            <button onclick="deleteSubtask(${st.id}, ${parentId})" style="background: transparent; border: none; color: #ef4444; cursor: pointer;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        subtaskContainer.innerHTML += div.outerHTML;
    });
}

function deleteSubtask(subId, parentId) {
    if (!confirm("Delete this subtask?")) return;
    tasks = tasks.filter(t => t.id !== subId);
    saveToLocal();
    renderTasks(); // Update main dashboard
    renderModalSubtasks(parentId); // Update the current modal view
}

// ✅ Use a direct listener to bypass 'onclick' scope issues
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('v-btn') && e.target.innerText === "Add") {
        console.log("Add Button Click Detected via Global Listener!");
        addManualSubtask();
    }
});