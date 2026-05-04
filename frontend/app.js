const state = {
  token: localStorage.getItem("classhub_token"),
  user: JSON.parse(localStorage.getItem("classhub_user") || "null"),
  groups: [],
  assignments: [],
  submissions: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const views = {
  overview: $("#overviewView"),
  groups: $("#groupsView"),
  assignments: $("#assignmentsView"),
  submissions: $("#submissionsView"),
  reports: $("#reportsView"),
  settings: $("#settingsView"),
};

const titles = {
  overview: "Начало",
  groups: "Групи",
  assignments: "Задания",
  submissions: "Предавания",
  reports: "Отчети",
  settings: "S3",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("classhub_token", token);
  localStorage.setItem("classhub_user", JSON.stringify(user));
  updateShell();
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.groups = [];
  state.assignments = [];
  state.submissions = [];
  localStorage.removeItem("classhub_token");
  localStorage.removeItem("classhub_user");
  updateShell();
}

function updateShell() {
  const isLogged = Boolean(state.token);
  $("#authPanel").classList.toggle("hidden", isLogged);
  $("#appContent").classList.toggle("hidden", !isLogged);
  $("#sessionName").textContent = state.user?.email || state.user?.user_name || "Няма вход";
  $("#sessionRole").textContent = state.user?.role || "Гост";
  $("#logoutButton").style.visibility = isLogged ? "visible" : "hidden";
  if (isLogged) refreshData();
  if (window.lucide) window.lucide.createIcons();
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Заявката не беше успешна";
    const details = payload?.errors ? ` ${JSON.stringify(payload.errors)}` : "";
    throw new Error(`${message}${details}`);
  }

  return payload;
}

function readForm(form) {
  const data = new FormData(form);
  const result = {};
  data.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

async function refreshData() {
  if (!state.token) return;

  try {
    const [groupsData, assignmentsData, submissionsData] = await Promise.all([
      api("/groups"),
      api("/assignments"),
      api("/submissions"),
    ]);
    state.groups = groupsData.groups || [];
    state.assignments = assignmentsData.assignments || [];
    state.submissions = submissionsData.submissions || [];
    renderAll();
    $("#lastStatus").textContent = "OK";
  } catch (error) {
    $("#lastStatus").textContent = "Грешка";
    showToast(error.message, "error");
  }
}

function switchView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  $("#viewTitle").textContent = titles[name] || "Начало";
  if (window.lucide) window.lucide.createIcons();
}

function renderAll() {
  renderMetrics();
  renderGroups();
  renderAssignments();
  renderSubmissions();
  fillSelects();
  if (window.lucide) window.lucide.createIcons();
}

function renderMetrics() {
  $("#groupCount").textContent = state.groups.length;
  $("#assignmentCount").textContent = state.assignments.length;
  $("#submissionCount").textContent = state.submissions.length;
  $("#recentAssignments").innerHTML = assignmentCards(state.assignments.slice(0, 4));
  $("#recentSubmissions").innerHTML = submissionCards(state.submissions.slice(0, 4));
}

function renderGroups() {
  $("#groupsList").innerHTML = state.groups.length
    ? state.groups.map((group) => `
      <article class="item-card">
        <strong>${escapeHtml(group.name)}</strong>
        <div class="pill-row">
          <span class="pill blue">ID: ${escapeHtml(group.id)}</span>
          <span class="pill ${group.private ? "coral" : ""}">${group.private ? "Частна" : "Публична"}</span>
        </div>
      </article>
    `).join("")
    : `<div class="empty">Няма групи</div>`;
}

function assignmentCards(assignments) {
  return assignments.length
    ? assignments.map((assignment) => `
      <article class="item-card">
        <strong>${escapeHtml(assignment.title)}</strong>
        <small>${escapeHtml(assignment.description || "Без описание")}</small>
        <div class="pill-row">
          <span class="pill blue">${escapeHtml(assignment.group_name || `Група ${assignment.group_id}`)}</span>
          <span class="pill gold">${assignment.due_date ? escapeHtml(assignment.due_date) : "Без срок"}</span>
          <span class="pill">ID: ${escapeHtml(assignment.id)}</span>
        </div>
      </article>
    `).join("")
    : `<div class="empty">Няма задания</div>`;
}

function renderAssignments() {
  $("#assignmentsList").innerHTML = assignmentCards(state.assignments);
}

function submissionCards(submissions) {
  return submissions.length
    ? submissions.map((submission) => `
      <article class="item-card">
        <strong>${escapeHtml(submission.assignment_title)}</strong>
        <small>${escapeHtml(submission.student_name)} · ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("bg-BG") : ""}</small>
        <small>${escapeHtml(submission.file_path)}</small>
        <div class="pill-row">
          <span class="pill blue">Ученик: ${escapeHtml(submission.student_id)}</span>
          <span class="pill ${submission.grade ? "gold" : "coral"}">${submission.grade ? `Оценка ${escapeHtml(submission.grade)}` : "Без оценка"}</span>
        </div>
        ${submission.comment ? `<small class="meta">${escapeHtml(submission.comment)}</small>` : ""}
      </article>
    `).join("")
    : `<div class="empty">Няма предадени домашни</div>`;
}

function renderSubmissions() {
  $("#submissionsList").innerHTML = submissionCards(state.submissions);
}

function fillSelects() {
  const groupOptions = state.groups
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} · ${escapeHtml(group.id)}</option>`)
    .join("");

  const assignmentOptions = state.assignments
    .map((assignment) => `<option value="${escapeHtml(assignment.id)}">${escapeHtml(assignment.title)} · ${escapeHtml(assignment.id)}</option>`)
    .join("");

  $$('select[name="group_id"]').forEach((select) => {
    select.innerHTML = groupOptions || `<option value="">Няма групи</option>`;
  });

  $$('select[name="assignment_id"]').forEach((select) => {
    select.innerHTML = assignmentOptions || `<option value="">Няма задания</option>`;
  });
}

function bindNavigation() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      $("#loginForm").classList.toggle("hidden", tab.dataset.authTab !== "login");
      $("#registerForm").classList.toggle("hidden", tab.dataset.authTab !== "register");
    });
  });
}

function bindForms() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      const payload = await api("/login", { method: "POST", body: JSON.stringify(data) });
      setSession(payload.token, { email: data.email, user_id: payload.user_id, role: payload.role });
      showToast("Успешен вход");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      const payload = await api("/registry", { method: "POST", body: JSON.stringify(data) });
      setSession(payload.token, { email: data.email, user_name: data.user_name, user_id: payload.user_id, role: data.role });
      event.currentTarget.reset();
      showToast("Профилът е създаден");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#groupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      data.is_private = event.currentTarget.elements.is_private.checked;
      await api("/groups", { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("Групата е създадена");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#addUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      await api(`/groups/${data.group_id}/users`, {
        method: "POST",
        body: JSON.stringify({ user_id: data.user_id }),
      });
      event.currentTarget.reset();
      showToast("Потребителят е добавен");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#assignmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      if (!data.due_date) delete data.due_date;
      await api("/assignments", { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("Заданието е създадено");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#uploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      await api("/submissions", { method: "POST", body: data });
      event.currentTarget.reset();
      await refreshData();
      showToast("Файлът е качен");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#gradeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      await api(`/submissions/${data.assignment_id}/${encodeURIComponent(data.student_id)}`, {
        method: "PUT",
        body: JSON.stringify({ grade: Number(data.grade), comment: data.comment || null }),
      });
      event.currentTarget.reset();
      await refreshData();
      showToast("Оценката е записана");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#reportForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      const payload = await api(`/assignments/${data.assignment_id}/missing-submissions`);
      $("#missingList").innerHTML = payload.missing_students?.length
        ? payload.missing_students.map((student) => `
          <article class="item-card">
            <strong>${escapeHtml(student.user_name)}</strong>
            <small>${escapeHtml(student.email)}</small>
            <span class="pill coral">ID: ${escapeHtml(student.id)}</span>
          </article>
        `).join("")
        : `<div class="empty">Всички са предали</div>`;
      showToast(`Непредали: ${payload.missing_count}`);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#countForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      const payload = await api(`/students/${encodeURIComponent(data.student_id)}/submission-count`);
      $("#countResult").textContent = `${payload.user_name}: ${payload.submission_count} качени домашни`;
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#refreshButton").addEventListener("click", refreshData);
  $("#logoutButton").addEventListener("click", clearSession);
}

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindForms();
  updateShell();
  switchView("overview");
  if (window.lucide) window.lucide.createIcons();
});
