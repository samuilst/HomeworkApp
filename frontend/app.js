const state = {
  token: localStorage.getItem("classhub_token"),
  user: JSON.parse(localStorage.getItem("classhub_user") || "null"),
  groups: [],
  assignments: [],
  submissions: [],
  teacher: { dashboard: null, groups: [], students: [], availableStudents: [] },
  admin: { stats: null, users: [], groups: [], assignments: [], submissions: [], roleFilter: "" },
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
  "/manage": { view: "manageView", title: "Manage", teacherOnly: true },
  "/settings": { view: "settingsView", title: "Settings", teacherOnly: true },
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
    if (button.id !== "logoutButton") button.disabled = isLoading;
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

function clearSession() {
  state.token = null;
  state.user = null;
  state.groups = [];
  state.assignments = [];
  state.submissions = [];
  state.teacher = { dashboard: null, groups: [], students: [], availableStudents: [] };
  state.admin = { stats: null, users: [], groups: [], assignments: [], submissions: [], roleFilter: "" };
  localStorage.removeItem("classhub_token");
  localStorage.removeItem("classhub_user");
  updateShell();
  navigate("/dashboard", true);
}

function updateShell() {
  const isLogged = Boolean(state.token);
  toggleHidden("#authPanel", isLogged);
  toggleHidden("#appContent", !isLogged);
  setText("#sessionName", state.user?.email || state.user?.user_name || "Guest");
  setText("#sessionRole", state.user?.role || "Not signed in");
  setText("#avatar", (state.user?.email || state.user?.user_name || "?").slice(0, 1).toUpperCase());
  const logoutButton = $("#logoutButton");
  if (logoutButton) logoutButton.style.visibility = isLogged ? "visible" : "hidden";

  $$(".role-admin").forEach((element) => element.classList.toggle("hidden", !isAdmin()));
  $$(".role-teacher").forEach((element) => element.classList.toggle("hidden", !isTeacher()));
  $$(".role-manage").forEach((element) => element.classList.toggle("hidden", !isTeacher()));
  $$(".role-student").forEach((element) => element.classList.toggle("hidden", !isStudent()));

  if (isLogged) refreshData();
  if (window.lucide) window.lucide.createIcons();
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
    const message = readableErrorText(payload, response);
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
    ];

    if (isTeacher()) {
      requests.push(
        api("/teacher/dashboard"),
        api("/teacher/groups"),
        api("/teacher/students"),
        api("/teacher/students?scope=all"),
      );
    }

    if (isAdmin()) {
      const roleParam = state.admin.roleFilter ? `?role=${encodeURIComponent(state.admin.roleFilter)}` : "";
      requests.push(
        api("/admin/stats"),
        api(`/admin/users${roleParam}`),
        api("/admin/groups"),
        api("/admin/assignments"),
        api("/admin/submissions"),
      );
    }

    const results = await Promise.all(requests);
    state.groups = results[0].groups || [];
    state.assignments = results[1].assignments || [];
    state.submissions = results[2].submissions || [];

    let index = 3;
    if (isTeacher()) {
      state.teacher.dashboard = results[index++] || null;
      state.teacher.groups = results[index++]?.groups || [];
      state.teacher.students = results[index++]?.students || [];
      state.teacher.availableStudents = results[index++]?.students || [];
    }

    if (isAdmin()) {
      state.admin.stats = results[index++] || null;
      state.admin.users = results[index++]?.users || [];
      state.admin.groups = results[index++]?.groups || [];
      state.admin.assignments = results[index++]?.assignments || [];
      state.admin.submissions = results[index++]?.submissions || [];
    }

    renderAll();
  } catch (error) {
    setText("#lastStatus", "Error");
    showToast(error.message, "error");
  } finally {
    setLoading(false);
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
  return canUseRoute(pathname) ? pathname : "/dashboard";
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
  renderStudentGrades();
  renderTeacherTools();
  renderAdminTools();
  fillSelects();
  updateShellRoleOnly();
  if (window.lucide) window.lucide.createIcons();
}

function updateShellRoleOnly() {
  $$(".role-admin").forEach((element) => element.classList.toggle("hidden", !isAdmin()));
  $$(".role-teacher").forEach((element) => element.classList.toggle("hidden", !isTeacher()));
  $$(".role-manage").forEach((element) => element.classList.toggle("hidden", !isTeacher()));
  $$(".role-student").forEach((element) => element.classList.toggle("hidden", !isStudent()));
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
        <small>${escapeHtml(submission.student_name || submission.student_id)} - ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("en-GB") : "No time"}</small>
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
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} - ${escapeHtml(group.id)}</option>`)
    .join("");

  const teacherGroupOptions = state.teacher.groups
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)} - ${escapeHtml(group.id)}</option>`)
    .join("");

  const assignmentOptions = state.assignments
    .map((assignment) => `<option value="${escapeHtml(assignment.id)}">${escapeHtml(assignment.title)} - ${escapeHtml(assignment.id)}</option>`)
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

  $$('select[data-student-select]').forEach((select) => {
    const options = select.dataset.studentSelect === "owned" ? ownedStudentOptions : allStudentOptions;
    select.innerHTML = options || `<option value="">No students available</option>`;
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
      setSession(payload.token, { email: data.email, user_id: payload.user_id, role: payload.role });
      showToast("Signed in");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  bindSubmit("#registerForm", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = readForm(form);
      const payload = await api("/registry", { method: "POST", body: JSON.stringify(data) });
      setSession(payload.token, { email: data.email, user_name: data.user_name, user_id: payload.user_id, role: "STUDENT" });
      resetForm(form);
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

  $("#refreshButton")?.addEventListener("click", refreshData);
  $("#logoutButton")?.addEventListener("click", clearSession);

  document.addEventListener("click", handleActionClick);
  document.addEventListener("submit", handleInlineSubmit);
}

async function handleInlineSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  const userId = form.dataset.editUser;
  const groupId = form.dataset.editGroup;
  const assignmentId = form.dataset.editAssignment;
  const gradeAssignmentId = form.dataset.gradeSubmission;

  if (!userId && !groupId && !assignmentId && !gradeAssignmentId) return;

  event.preventDefault();

  try {
    if (userId) {
      const data = compactPayload(readForm(form));
      await api(`/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      await refreshData();
      showToast("User saved");
      return;
    }

    if (groupId) {
      const data = readForm(form);
      await api(`/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          is_private: isChecked(form, "is_private"),
        }),
      });
      await refreshData();
      showToast("Group saved");
      return;
    }

    if (assignmentId) {
      const data = compactPayload(readForm(form));
      await api(`/assignments/${assignmentId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      await refreshData();
      showToast("Homework saved");
      return;
    }

    if (gradeAssignmentId) {
      const data = readForm(form);
      await api(`/submissions/${gradeAssignmentId}/${encodeURIComponent(form.dataset.studentId)}`, {
        method: "PUT",
        body: JSON.stringify({ grade: Number(data.grade), comment: data.comment || null }),
      });
      await refreshData();
      showToast("Grade saved");
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function renderMissingReport(assignmentId) {
  const payload = await api(`/assignments/${assignmentId}/missing-submissions`);
  setHtml("#missingList", payload.missing_students?.length
    ? payload.missing_students.map((student) => `
      <article class="item-card">
        <strong>${escapeHtml(student.user_name)}</strong>
        <small>${escapeHtml(student.email)}</small>
        <span class="pill coral">ID ${escapeHtml(student.id)}</span>
      </article>
    `).join("")
    : emptyState("Everyone submitted this homework."));
  showToast(`Missing submissions: ${payload.missing_count}`);
}

async function handleActionClick(event) {
  const button = event.target?.closest?.("button");
  if (!button || state.loading) return;

  try {
    if (button.dataset.openFile) {
      await openSubmissionFile(button.dataset.openFile);
    }

    if (button.dataset.roleFilter !== undefined) {
      state.admin.roleFilter = button.dataset.roleFilter;
      await refreshData();
      showToast(state.admin.roleFilter ? `Filtered ${state.admin.roleFilter.toLowerCase()} users` : "Showing all users");
    }

    if (button.dataset.setRole) {
      await api(`/admin/users/${encodeURIComponent(button.dataset.setRole)}`, {
        method: "PUT",
        body: JSON.stringify({ role: button.dataset.role }),
      });
      await refreshData();
      showToast("Role updated");
    }

    if (button.dataset.deleteUser) {
      await api(`/admin/users/${encodeURIComponent(button.dataset.deleteUser)}`, { method: "DELETE" });
      await refreshData();
      showToast("User deleted");
    }

    if (button.dataset.deleteGroup) {
      await api(`/groups/${button.dataset.deleteGroup}`, { method: "DELETE" });
      await refreshData();
      showToast("Group deleted");
    }

    if (button.dataset.missingAssignment) {
      const form = $("#reportForm");
      setFormField(form, "assignment_id", button.dataset.missingAssignment);
      navigate("/homework");
      await renderMissingReport(button.dataset.missingAssignment);
    }

    if (button.dataset.deleteAssignment) {
      await api(`/assignments/${button.dataset.deleteAssignment}`, { method: "DELETE" });
      await refreshData();
      showToast("Homework deleted");
    }

    if (button.dataset.fillGrade) {
      const form = $("#gradeForm");
      if (form) {
        setFormField(form, "assignment_id", button.dataset.fillGrade);
        setFormField(form, "student_id", button.dataset.studentId || "");
      }
      navigate("/homework");
    }

    if (button.dataset.deleteSubmission) {
      await api("/submissions", {
        method: "DELETE",
        body: JSON.stringify({
          assignment_id: Number(button.dataset.deleteSubmission),
          student_id: button.dataset.studentId,
        }),
      });
      await refreshData();
      showToast("Submission deleted");
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function openSubmissionFile(path) {
  const fileWindow = window.open("about:blank", "_blank");
  if (fileWindow) {
    fileWindow.document.title = "Opening file";
    fileWindow.document.body.innerHTML = "<p style=\"font-family: system-ui; padding: 24px;\">Opening file...</p>";
  }

  const headers = new Headers();
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);

  const response = await fetch(path, { headers });
  if (!response.ok) {
    if (fileWindow) fileWindow.close();
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    throw new Error(readableErrorText(payload, response));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (fileWindow) {
    fileWindow.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindForms();
  navigate(normalizePath(location.pathname), true);
  updateShell();
  if (window.lucide) window.lucide.createIcons();
});
