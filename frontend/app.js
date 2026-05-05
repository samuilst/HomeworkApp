const state = {
  token: localStorage.getItem("classhub_token"),
  user: JSON.parse(localStorage.getItem("classhub_user") || "null"),
  groups: [],
  assignments: [],
  submissions: [],
  adminStats: null,
  adminUsers: [],
  teacherStats: null,
  teacherStudents: [],
  loading: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function setHtml(selector, value) {
  const element = $(selector);
  if (element) element.innerHTML = value;
}

function toggleHidden(selector, isHidden) {
  const element = $(selector);
  if (element) element.classList.toggle("hidden", isHidden);
}

function bindSubmit(selector, handler) {
  const form = $(selector);
  if (form) form.addEventListener("submit", handler);
}

function getFormField(form, name) {
  return form?.elements?.[name] || null;
}

function setFormField(form, name, value) {
  const field = getFormField(form, name);
  if (field) field.value = value;
}

function isChecked(form, name) {
  return Boolean(getFormField(form, name)?.checked);
}

function resetForm(form) {
  if (form instanceof HTMLFormElement) form.reset();
}

const routes = {
  "/dashboard": { view: "dashboardView", title: "Dashboard" },
  "/files": { view: "filesView", title: "Files" },
  "/homework": { view: "homeworkView", title: "Homework" },
  "/teacher": { view: "teacherView", title: "Teacher" },
  "/admin": { view: "adminView", title: "Admin" },
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

function currentRole() {
  return state.user?.role || "";
}

function isAdmin() {
  return currentRole() === "ADMIN";
}

function isTeacher() {
  return currentRole() === "TEACHER" || isAdmin();
}

function isStudent() {
  return currentRole() === "STUDENT";
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  if (!toast) {
    console[type === "error" ? "error" : "log"](message);
    return;
  }
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function canUseRoute(path) {
  const route = routes[path];
  return Boolean(route) && (!route.teacherOnly || isTeacher());
}

function setLoading(isLoading) {
  state.loading = isLoading;
  $$("button").forEach((button) => {
    const keepEnabled = button.id === "logoutButton" || button.classList.contains("nav-button") || button.classList.contains("tab");
    if (!keepEnabled) button.disabled = isLoading;
  });
  setText("#lastStatus", isLoading ? "Syncing" : "Ready");
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("classhub_token", token);
  localStorage.setItem("classhub_user", JSON.stringify(user));
  updateShell();
}

function authUserFromPayload(payload, fallback = {}) {
  const user = payload.user || {};
  return {
    user_id: user.user_id || payload.user_id,
    user_name: user.user_name || payload.user_name || fallback.user_name || "",
    email: user.email || payload.email || fallback.email || "",
    role: user.role || payload.role || fallback.role || "STUDENT",
  };
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.groups = [];
  state.assignments = [];
  state.submissions = [];
  state.adminStats = null;
  state.adminUsers = [];
  state.teacherStats = null;
  state.teacherStudents = [];
  localStorage.removeItem("classhub_token");
  localStorage.removeItem("classhub_user");
  updateShell();
  navigate("/dashboard", true);
}

function expireSession() {
  state.token = null;
  state.user = null;
  state.groups = [];
  state.assignments = [];
  state.submissions = [];
  state.adminStats = null;
  state.adminUsers = [];
  state.teacherStats = null;
  state.teacherStudents = [];
  localStorage.removeItem("classhub_token");
  localStorage.removeItem("classhub_user");
  $("#authPanel").classList.remove("hidden");
  $("#appContent").classList.add("hidden");
  $("#sessionName").textContent = "Guest";
  $("#sessionRole").textContent = "Not signed in";
  $("#avatar").textContent = "?";
  updateRoleNavigation();
  updateRoleSections();
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
  updateRoleNavigation();
  updateRoleSections();
  if (isLogged) refreshData();
  if (window.lucide) window.lucide.createIcons();
}

function updateRoleNavigation() {
  const role = state.user?.role;
  $$(".teacher-nav").forEach((item) => item.classList.toggle("hidden", !["TEACHER", "ADMIN"].includes(role)));
  $$(".admin-nav").forEach((item) => item.classList.toggle("hidden", role !== "ADMIN"));
}

function updateRoleSections() {
  const role = state.user?.role;
  $$(".student-only").forEach((item) => item.classList.toggle("hidden", role !== "STUDENT"));
  $$(".teacher-only").forEach((item) => item.classList.toggle("hidden", !["TEACHER", "ADMIN"].includes(role)));
  $$(".admin-only").forEach((item) => item.classList.toggle("hidden", role !== "ADMIN"));
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
    throw new Error("Server is not reachable. Check that Flask is running on port 5000.");
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session expired. Please sign in again.");
    }
    const message = payload?.message || payload?.error || `Request failed (${response.status})`;
    const details = payload?.errors ? ` ${formatErrors(payload.errors)}` : "";
    throw new Error(`${message}${details}`);
  }

  return payload;
}

function formatErrors(errors) {
  if (typeof errors === "string") return errors;
  return Object.entries(errors)
    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
    .join("; ");
}

function readForm(form) {
  const data = new FormData(form);
  const result = {};
  data.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function compactPayload(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== "" && value !== null));
}

function readableErrorText(payload, response) {
  if (payload && typeof payload === "object") {
    return payload.message || payload.error || JSON.stringify(payload);
  }

  const text = String(payload || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || response.statusText || `HTTP ${response.status}`;
}

async function refreshData() {
  if (!state.token || state.loading) return;

  setLoading(true);
  showLoadingStates();
  try {
    const requests = [
      api("/groups"),
      api("/assignments"),
      api("/submissions"),
    ]);
    state.groups = groupsData.groups || [];
    state.assignments = assignmentsData.assignments || [];
    state.submissions = submissionsData.submissions || [];
    await refreshRoleData();
    renderAll();
  } catch (error) {
    setText("#lastStatus", "Error");
    showToast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function refreshRoleData() {
  if (["TEACHER", "ADMIN"].includes(state.user?.role)) {
    const [teacherStats, teacherStudents] = await Promise.all([
      api("/teacher/dashboard"),
      api("/teacher/students"),
    ]);
    state.teacherStats = teacherStats;
    state.teacherStudents = teacherStudents.students || [];
  }

  if (state.user?.role === "ADMIN") {
    const [adminStats, adminUsers] = await Promise.all([
      api("/admin/stats"),
      api("/admin/users"),
    ]);
    state.adminStats = adminStats;
    state.adminUsers = adminUsers.users || [];
  }
}

function showLoadingStates() {
  [
    "recentAssignments",
    "recentSubmissions",
    "groupsList",
    "assignmentsList",
    "submissionsList",
    "teacherStudentsList",
    "adminUsersList",
    "adminGroupsList",
    "adminAssignmentsList",
    "adminSubmissionsList",
  ].forEach((id) => {
    const element = $(`#${id}`);
    if (element && !element.children.length) {
      element.innerHTML = `<div class="loading-state">Loading</div>`;
    }
  });
}

function normalizePath(pathname) {
  if (pathname === "/admin" && state.user?.role !== "ADMIN") return "/dashboard";
  if (pathname === "/teacher" && !["TEACHER", "ADMIN"].includes(state.user?.role)) return "/dashboard";
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
  $(`#${route.view}`)?.classList.add("active");
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === path);
  });
  setText("#viewTitle", route.title);
  if (window.lucide) window.lucide.createIcons();
}

function renderAll() {
  renderMetrics();
  renderGroups();
  renderAssignments();
  renderSubmissions();
  renderTeacher();
  renderAdmin();
  fillSelects();
  updateShellRoleOnly();
  if (window.lucide) window.lucide.createIcons();
}

function renderTeacher() {
  const stats = state.teacherStats || {};
  $("#teacherGroupCount").textContent = stats.groups ?? 0;
  $("#teacherStudentCount").textContent = stats.students ?? 0;
  $("#teacherAssignmentCount").textContent = stats.assignments ?? 0;
  $("#teacherUngradedCount").textContent = stats.ungraded_submissions ?? 0;

  $("#teacherStudentsList").innerHTML = state.teacherStudents.length
    ? state.teacherStudents.map((student) => `
      <article class="item-card">
        <strong>${escapeHtml(student.user_name)}</strong>
        <small>${escapeHtml(student.email)}</small>
        <div class="pill-row">
          <span class="pill blue">ID ${escapeHtml(student.id)}</span>
          <span class="pill green">${escapeHtml(student.role)}</span>
        </div>
      </article>
    `).join("")
    : emptyState("No students in your groups yet.");
}

function renderAdmin() {
  const stats = state.adminStats || {};
  $("#adminUserCount").textContent = stats.users ?? 0;
  $("#adminTeacherCount").textContent = stats.teachers ?? 0;
  $("#adminStudentCount").textContent = stats.students ?? 0;
  $("#adminSubmissionCount").textContent = stats.submissions ?? 0;

  $("#adminUsersList").innerHTML = state.adminUsers.length
    ? state.adminUsers.map((user) => `
      <article class="admin-row">
        <div>
          <strong>${escapeHtml(user.user_name)}</strong>
          <small>${escapeHtml(user.email)}</small>
          <small>ID ${escapeHtml(user.id)}</small>
        </div>
        <form class="role-form" data-user-id="${escapeHtml(user.id)}">
          <select name="role" aria-label="Role for ${escapeHtml(user.user_name)}">
            <option value="STUDENT" ${user.role === "STUDENT" ? "selected" : ""}>STUDENT</option>
            <option value="TEACHER" ${user.role === "TEACHER" ? "selected" : ""}>TEACHER</option>
            <option value="ADMIN" ${user.role === "ADMIN" ? "selected" : ""}>ADMIN</option>
          </select>
          <button class="secondary-button" type="submit"><i data-lucide="save"></i><span>Save role</span></button>
        </form>
      </article>
    `).join("")
    : emptyState("No users found.");

  bindRoleForms();
}

function renderMetrics() {
  setText("#groupCount", state.groups.length);
  setText("#assignmentCount", state.assignments.length);
  setText("#submissionCount", state.submissions.length);
  setHtml("#recentAssignments", assignmentCards(state.assignments.slice(0, 4)));
  setHtml("#recentSubmissions", fileCards(state.submissions.slice(0, 4), false));
}

function renderGroups() {
  setHtml("#groupsList", state.groups.length
    ? state.groups.map((group) => `
      <article class="item-card">
        <strong>${escapeHtml(group.name)}</strong>
        <small>Workspace for students and homework assignments.</small>
        <div class="pill-row">
          <span class="pill blue">ID ${escapeHtml(group.id)}</span>
          <span class="pill ${group.private ? "coral" : "green"}">${group.private ? "Private" : "Public"}</span>
        </div>
        ${isTeacher() ? groupManageMenu(group.id, group.name, group.private, false) : ""}
      </article>
    `).join("")
    : emptyState("No groups yet. Create one to start organizing homework."));
}

function groupManageMenu(id, name, isPrivate, adminView = false) {
  return `
    <details class="action-menu">
      <summary><i data-lucide="settings-2"></i><span>Manage</span></summary>
      <form class="inline-edit-form" data-edit-group="${escapeHtml(id)}">
        <label>Name<input name="name" value="${escapeHtml(name)}" maxlength="255" required /></label>
        <label class="check-row"><input name="is_private" type="checkbox" ${isPrivate ? "checked" : ""} /> Private group</label>
        <button class="secondary-button" type="submit"><i data-lucide="save"></i><span>Save group</span></button>
      </form>
      ${adminView ? `
        <button class="danger-button" type="button" data-delete-group="${escapeHtml(id)}"><i data-lucide="trash-2"></i><span>Delete group</span></button>
      ` : ""}
    </details>
  `;
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
        ${isTeacher() ? `
          <details class="action-menu">
            <summary><i data-lucide="settings-2"></i><span>Manage</span></summary>
            <form class="inline-edit-form" data-edit-assignment="${escapeHtml(assignment.id)}">
              <label>Title<input name="title" value="${escapeHtml(assignment.title)}" maxlength="255" required /></label>
              <label>Due date<input name="due_date" type="date" value="${assignment.due_date ? escapeHtml(assignment.due_date) : ""}" /></label>
              <label>Description<textarea name="description" rows="3">${escapeHtml(assignment.description || "")}</textarea></label>
              <button class="secondary-button" type="submit"><i data-lucide="save"></i><span>Save homework</span></button>
            </form>
            <button class="ghost-button" type="button" data-missing-assignment="${escapeHtml(assignment.id)}"><i data-lucide="search"></i><span>Missing</span></button>
            <button class="danger-button" type="button" data-delete-assignment="${escapeHtml(assignment.id)}"><i data-lucide="trash-2"></i><span>Delete</span></button>
          </details>
        ` : ""}
      </article>
    `).join("")
    : emptyState(isStudent() ? "No homework assigned yet." : "No homework yet. Teachers can create assignments here.");
}

function renderAssignments() {
  setHtml("#assignmentsList", assignmentCards(state.assignments));
}

function renderStudentGrades() {
  if (!isStudent()) return;

  setHtml("#studentGradesList", state.submissions.length
    ? fileCards(state.submissions)
    : emptyState("Submitted homework and grades will appear here."));
}

function fileCards(submissions, grid = true, admin = false) {
  return submissions.length
    ? submissions.map((submission) => `
      <article class="${grid ? "file-card" : "item-card"}">
        ${grid ? `<div class="file-icon"><i data-lucide="file-text"></i></div>` : ""}
        <strong>${escapeHtml(submission.assignment_title || "Submission")}</strong>
        <small>${escapeHtml(submission.student_name || submission.student_id)} &middot; ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("en-GB") : "No time"}</small>
        <small>${escapeHtml(submission.file_path)}</small>
        <div class="pill-row">
          <span class="pill blue">Student ${escapeHtml(submission.student_id)}</span>
          <span class="pill">Homework ${escapeHtml(submission.assignment_id)}</span>
          <span class="pill ${submission.grade ? "gold" : "coral"}">${submission.grade ? `Grade ${escapeHtml(submission.grade)}` : "Ungraded"}</span>
        </div>
        ${submission.download_url ? `
          <div class="card-actions">
            <button class="ghost-button" type="button" data-open-file="${escapeHtml(submission.download_url)}">
              <i data-lucide="external-link"></i><span>Open file</span>
            </button>
          </div>
        ` : ""}
        ${submission.comment ? `<small class="meta">${escapeHtml(submission.comment)}</small>` : ""}
        ${(isTeacher() || admin) ? `
          <details class="action-menu">
            <summary><i data-lucide="settings-2"></i><span>Manage</span></summary>
            <form class="inline-edit-form" data-grade-submission="${escapeHtml(submission.assignment_id)}" data-student-id="${escapeHtml(submission.student_id)}">
              <label>Grade<input name="grade" type="number" min="2" max="6" value="${submission.grade ? escapeHtml(submission.grade) : ""}" required /></label>
              <label>Comment<textarea name="comment" rows="3">${escapeHtml(submission.comment || "")}</textarea></label>
              <button class="secondary-button" type="submit"><i data-lucide="badge-check"></i><span>Save grade</span></button>
            </form>
            <button class="danger-button" type="button" data-delete-submission="${escapeHtml(submission.assignment_id)}" data-student-id="${escapeHtml(submission.student_id)}"><i data-lucide="trash-2"></i><span>Delete</span></button>
          </details>
        ` : ""}
      </article>
    `).join("")
    : emptyState("No uploaded files yet. Student submissions will appear here.");
}

function renderSubmissions() {
  setHtml("#submissionsList", fileCards(state.submissions));
}

function renderTeacherTools() {
  if (!isTeacher()) return;
  const dashboard = state.teacher.dashboard || {};
  setText("#teacherGroupCount", dashboard.groups ?? 0);
  setText("#teacherStudentCount", dashboard.students ?? 0);
  setText("#teacherAssignmentCount", dashboard.assignments ?? 0);
  setText("#teacherUngradedCount", dashboard.ungraded_submissions ?? 0);
  setHtml("#teacherStudentsList", state.teacher.students.length
    ? state.teacher.students.map(userCard).join("")
    : emptyState("No students in your groups yet."));
}

function renderAdminTools() {
  if (!isAdmin()) return;
  const stats = state.admin.stats || {};
  setText("#adminUsersCount", stats.users ?? 0);
  setText("#adminTeachersCount", stats.teachers ?? 0);
  setText("#adminStudentsCount", stats.students ?? 0);
  setText("#adminUngradedCount", stats.ungraded_submissions ?? 0);

  setHtml("#adminUsersList", state.admin.users.length
    ? state.admin.users.map((user) => userCard(user, true)).join("")
    : emptyState("No users found."));

  setHtml("#adminGroupsList", state.admin.groups.length
    ? state.admin.groups.map((group) => `
      <article class="item-card">
        <strong>${escapeHtml(group.name)}</strong>
        <small>Owner ${escapeHtml(group.owner_id)} - ${escapeHtml(group.member_count)} member(s)</small>
        <div class="pill-row">
          <span class="pill blue">ID ${escapeHtml(group.id)}</span>
          <span class="pill ${group.is_private ? "coral" : "green"}">${group.is_private ? "Private" : "Public"}</span>
        </div>
        ${groupManageMenu(group.id, group.name, group.is_private, true)}
      </article>
    `).join("")
    : emptyState("No groups found."));

  setHtml("#adminAssignmentsList", state.admin.assignments.length
    ? assignmentCards(state.admin.assignments)
    : emptyState("No homework found."));

  setHtml("#adminSubmissionsList", fileCards(state.admin.submissions, true, true));
}

function userCard(user, adminActions = false) {
  return `
    <article class="item-card">
      <strong>${escapeHtml(user.user_name)}</strong>
      <small>${escapeHtml(user.email)}</small>
      <div class="pill-row">
        <span class="pill blue">ID ${escapeHtml(user.id)}</span>
        <span class="pill ${user.role === "ADMIN" ? "coral" : user.role === "TEACHER" ? "gold" : "green"}">${escapeHtml(user.role)}</span>
      </div>
      ${adminActions ? `
        <details class="action-menu">
          <summary><i data-lucide="settings-2"></i><span>Manage</span></summary>
          <form class="inline-edit-form" data-edit-user="${escapeHtml(user.id)}">
            <label>Username<input name="user_name" value="${escapeHtml(user.user_name)}" maxlength="50" required /></label>
            <label>Email<input name="email" type="email" value="${escapeHtml(user.email)}" required /></label>
            <label>New password<input name="password" type="password" autocomplete="new-password" /></label>
            <label>Role
              <select name="role" required>
                <option value="STUDENT" ${user.role === "STUDENT" ? "selected" : ""}>Student</option>
                <option value="TEACHER" ${user.role === "TEACHER" ? "selected" : ""}>Teacher</option>
                <option value="ADMIN" ${user.role === "ADMIN" ? "selected" : ""}>Admin</option>
              </select>
            </label>
            <button class="secondary-button" type="submit"><i data-lucide="save"></i><span>Save user</span></button>
          </form>
          <button class="danger-button" type="button" data-delete-user="${escapeHtml(user.id)}"><i data-lucide="trash-2"></i><span>Delete</span></button>
        </details>
      ` : ""}
    </article>
  `;
}

function emptyState(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function fillSelects() {
  const groupOptions = state.groups
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} &middot; ${escapeHtml(group.id)}</option>`)
    .join("");

  const assignmentOptions = state.assignments
    .map((assignment) => `<option value="${escapeHtml(assignment.id)}">${escapeHtml(assignment.title)} &middot; ${escapeHtml(assignment.id)}</option>`)
    .join("");

  const studentOption = (student) => `
    <option value="${escapeHtml(student.id)}">${escapeHtml(student.user_name)} - ${escapeHtml(student.email)}</option>
  `;
  const allStudentOptions = state.teacher.availableStudents.map(studentOption).join("");
  const ownedStudentOptions = state.teacher.students.map(studentOption).join("");

  $$('select[name="group_id"]').forEach((select) => {
    const isTeacherStudentSelect = select.closest("#teacherStudentForm");
    if (isTeacherStudentSelect) {
      select.innerHTML = `<option value="">Do not add yet</option>${teacherGroupOptions || groupOptions}`;
    } else {
      select.innerHTML = groupOptions || `<option value="">No groups available</option>`;
    }
  });

  $$('select[name="assignment_id"]').forEach((select) => {
    select.innerHTML = assignmentOptions || `<option value="">No homework available</option>`;
  });

  $$('#teacherCreateStudentForm select[name="group_id"]').forEach((select) => {
    select.innerHTML = groupOptions || `<option value="">Create a group first</option>`;
    select.disabled = !groupOptions;
  });
}

function bindRoleForms() {
  $$(".role-form").forEach((form) => {
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const userId = event.currentTarget.dataset.userId;
        const role = event.currentTarget.elements.role.value;
        await api(`/admin/users/${encodeURIComponent(userId)}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        });
        if (state.user?.user_id === userId) {
          state.user.role = role;
          localStorage.setItem("classhub_user", JSON.stringify(state.user));
          updateRoleNavigation();
          updateRoleSections();
          navigate(normalizePath(location.pathname), true);
        }
        await refreshData();
        showToast("User role updated");
      } catch (error) {
        showToast(error.message, "error");
      }
    });
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
      toggleHidden("#loginForm", tab.dataset.authTab !== "login");
      toggleHidden("#registerForm", tab.dataset.authTab !== "register");
    });
  });
}

function bindForms() {
  bindSubmit("#loginForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      const payload = await api("/login", { method: "POST", body: JSON.stringify(data) });
      setSession(payload.token, authUserFromPayload(payload, { email: data.email }));
      showToast("Signed in");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#registerForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(event.currentTarget);
      const payload = await api("/register", { method: "POST", body: JSON.stringify(data) });
      setSession(payload.token, authUserFromPayload(payload, { email: data.email, user_name: data.user_name, role: "STUDENT" }));
      event.currentTarget.reset();
      showToast("Student account created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#groupForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      data.is_private = isChecked(form, "is_private");
      await api("/groups", { method: "POST", body: JSON.stringify(data) });
      resetForm(form);
      await refreshData();
      showToast("Group created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#addUserForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      await api(`/groups/${data.group_id}/users`, {
        method: "POST",
        body: JSON.stringify({ user_id: data.user_id }),
      });
      resetForm(form);
      await refreshData();
      showToast("Student added");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#removeUserForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      await api(`/groups/${data.group_id}/users/${encodeURIComponent(data.user_id)}`, { method: "DELETE" });
      resetForm(form);
      await refreshData();
      showToast("Student removed");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#assignmentForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      if (!data.due_date) delete data.due_date;
      data.group_id = Number(data.group_id);
      await api("/assignments", { method: "POST", body: JSON.stringify(data) });
      resetForm(form);
      await refreshData();
      showToast("Homework created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#uploadForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = new FormData(form);
      await api("/submissions", { method: "POST", body: data });
      resetForm(form);
      await refreshData();
      showToast("File uploaded to S3");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#gradeForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      await api(`/submissions/${data.assignment_id}/${encodeURIComponent(data.student_id)}`, {
        method: "PUT",
        body: JSON.stringify({ grade: Number(data.grade), comment: data.comment || null }),
      });
      resetForm(form);
      await refreshData();
      showToast("Grade saved");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#reportForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      await renderMissingReport(data.assignment_id);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#countForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      const payload = await api(`/students/${encodeURIComponent(data.student_id)}/submission-count`);
      setText("#countResult", `${payload.user_name}: ${payload.submission_count} uploaded file(s)`);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#teacherStudentForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = compactPayload(readForm(form));
      if (data.group_id) data.group_id = Number(data.group_id);
      await api("/teacher/students", { method: "POST", body: JSON.stringify(data) });
      resetForm(form);
      await refreshData();
      showToast("Student created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#adminCreateUserForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      await api("/admin/users", { method: "POST", body: JSON.stringify(data) });
      resetForm(form);
      await refreshData();
      showToast("User created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#teacherCreateStudentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      if (!data.group_id) {
        throw new Error("Create a group first, then create the student inside that group.");
      }
      await api("/teacher/students", { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("Student created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#adminCreateUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      await api("/admin/users", { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("User created");
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
