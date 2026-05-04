const state = {
  token: localStorage.getItem("classhub_token"),
  user: JSON.parse(localStorage.getItem("classhub_user") || "null"),
  groups: [],
  assignments: [],
  submissions: [],
  loading: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const routes = {
  "/dashboard": { view: "dashboardView", title: "Dashboard" },
  "/files": { view: "filesView", title: "Files" },
  "/homework": { view: "homeworkView", title: "Homework" },
  "/settings": { view: "settingsView", title: "Settings" },
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

function setLoading(isLoading) {
  state.loading = isLoading;
  $$("button").forEach((button) => {
    if (button.id !== "logoutButton") button.disabled = isLoading;
  });
  $("#lastStatus").textContent = isLoading ? "Syncing" : "Ready";
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
  navigate("/dashboard", true);
}

function updateShell() {
  const isLogged = Boolean(state.token);
  $("#authPanel").classList.toggle("hidden", isLogged);
  $("#appContent").classList.toggle("hidden", !isLogged);
  $("#sessionName").textContent = state.user?.email || state.user?.user_name || "Guest";
  $("#sessionRole").textContent = state.user?.role || "Not signed in";
  $("#avatar").textContent = (state.user?.email || state.user?.user_name || "?").slice(0, 1).toUpperCase();
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
    const message = payload?.message || payload?.error || "Request failed";
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
  if (!state.token || state.loading) return;

  setLoading(true);
  showLoadingStates();
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
  } catch (error) {
    $("#lastStatus").textContent = "Error";
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function showLoadingStates() {
  ["recentAssignments", "recentSubmissions", "groupsList", "assignmentsList", "submissionsList"].forEach((id) => {
    const element = $(`#${id}`);
    if (element && !element.children.length) {
      element.innerHTML = `<div class="loading-state">Loading</div>`;
    }
  });
}

function normalizePath(pathname) {
  return routes[pathname] ? pathname : "/dashboard";
}

function navigate(path, replace = false) {
  const nextPath = normalizePath(path);
  if (replace) {
    history.replaceState({}, "", nextPath);
  } else if (location.pathname !== nextPath) {
    history.pushState({}, "", nextPath);
  }
  renderRoute(nextPath);
}

function renderRoute(path = normalizePath(location.pathname)) {
  const route = routes[path];
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${route.view}`).classList.add("active");
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === path);
  });
  $("#viewTitle").textContent = route.title;
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
  $("#recentSubmissions").innerHTML = fileCards(state.submissions.slice(0, 4), false);
}

function renderGroups() {
  $("#groupsList").innerHTML = state.groups.length
    ? state.groups.map((group) => `
      <article class="item-card">
        <strong>${escapeHtml(group.name)}</strong>
        <small>Workspace for students and homework assignments.</small>
        <div class="pill-row">
          <span class="pill blue">ID ${escapeHtml(group.id)}</span>
          <span class="pill ${group.private ? "coral" : "green"}">${group.private ? "Private" : "Public"}</span>
        </div>
      </article>
    `).join("")
    : emptyState("No groups yet. Create one to start organizing homework.");
}

function assignmentCards(assignments) {
  return assignments.length
    ? assignments.map((assignment) => `
      <article class="item-card">
        <strong>${escapeHtml(assignment.title)}</strong>
        <small>${escapeHtml(assignment.description || "No description")}</small>
        <div class="pill-row">
          <span class="pill blue">${escapeHtml(assignment.group_name || `Group ${assignment.group_id}`)}</span>
          <span class="pill gold">${assignment.due_date ? escapeHtml(assignment.due_date) : "No due date"}</span>
          <span class="pill">ID ${escapeHtml(assignment.id)}</span>
        </div>
      </article>
    `).join("")
    : emptyState("No homework yet. Teachers can create assignments here.");
}

function renderAssignments() {
  $("#assignmentsList").innerHTML = assignmentCards(state.assignments);
}

function fileCards(submissions, grid = true) {
  return submissions.length
    ? submissions.map((submission) => `
      <article class="${grid ? "file-card" : "item-card"}">
        ${grid ? `<div class="file-icon"><i data-lucide="file-text"></i></div>` : ""}
        <strong>${escapeHtml(submission.assignment_title || "Submission")}</strong>
        <small>${escapeHtml(submission.student_name || submission.student_id)} · ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("en-GB") : "No time"}</small>
        <small>${escapeHtml(submission.file_path)}</small>
        <div class="pill-row">
          <span class="pill blue">Student ${escapeHtml(submission.student_id)}</span>
          <span class="pill ${submission.grade ? "gold" : "coral"}">${submission.grade ? `Grade ${escapeHtml(submission.grade)}` : "Ungraded"}</span>
        </div>
        ${submission.comment ? `<small class="meta">${escapeHtml(submission.comment)}</small>` : ""}
      </article>
    `).join("")
    : emptyState("No uploaded files yet. Student submissions will appear here.");
}

function renderSubmissions() {
  $("#submissionsList").innerHTML = fileCards(state.submissions);
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function fillSelects() {
  const groupOptions = state.groups
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} · ${escapeHtml(group.id)}</option>`)
    .join("");

  const assignmentOptions = state.assignments
    .map((assignment) => `<option value="${escapeHtml(assignment.id)}">${escapeHtml(assignment.title)} · ${escapeHtml(assignment.id)}</option>`)
    .join("");

  $$('select[name="group_id"]').forEach((select) => {
    select.innerHTML = groupOptions || `<option value="">No groups available</option>`;
  });

  $$('select[name="assignment_id"]').forEach((select) => {
    select.innerHTML = assignmentOptions || `<option value="">No homework available</option>`;
  });
}

function bindNavigation() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });

  window.addEventListener("popstate", () => renderRoute(normalizePath(location.pathname)));

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
      showToast("Signed in");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      const payload = await api("/registry", { method: "POST", body: JSON.stringify(data) });
      setSession(payload.token, { email: data.email, user_name: data.user_name, user_id: payload.user_id, role: "STUDENT" });
      event.currentTarget.reset();
      showToast("Student account created");
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
      showToast("Group created");
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
      showToast("Student added");
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
      showToast("Homework created");
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
      showToast("File uploaded to S3");
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
      showToast("Grade saved");
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
            <span class="pill coral">ID ${escapeHtml(student.id)}</span>
          </article>
        `).join("")
        : emptyState("Everyone submitted this homework.");
      showToast(`Missing submissions: ${payload.missing_count}`);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#countForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      const payload = await api(`/students/${encodeURIComponent(data.student_id)}/submission-count`);
      $("#countResult").textContent = `${payload.user_name}: ${payload.submission_count} uploaded file(s)`;
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
  navigate(normalizePath(location.pathname), true);
  updateShell();
  if (window.lucide) window.lucide.createIcons();
});
