const state = {
  token: localStorage.getItem("classhub_token"),
  user: JSON.parse(localStorage.getItem("classhub_user") || "null"),
  groups: [],
  assignments: [],
  submissions: [],
  teacher: { dashboard: null, groups: [], students: [] },
  admin: { stats: null, users: [], groups: [], assignments: [], submissions: [], roleFilter: "" },
  loading: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const routes = {
  "/dashboard": { view: "dashboardView", title: "Dashboard" },
  "/files": { view: "filesView", title: "Files" },
  "/homework": { view: "homeworkView", title: "Homework" },
  "/manage": { view: "manageView", title: "Manage" },
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
  state.teacher = { dashboard: null, groups: [], students: [] };
  state.admin = { stats: null, users: [], groups: [], assignments: [], submissions: [], roleFilter: "" };
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

  $$(".role-admin").forEach((element) => element.classList.toggle("hidden", !isAdmin()));
  $$(".role-teacher").forEach((element) => element.classList.toggle("hidden", !isTeacher()));
  $$(".role-manage").forEach((element) => element.classList.toggle("hidden", !isTeacher()));

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

function compactPayload(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== "" && value !== null));
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
      requests.push(api("/teacher/dashboard"), api("/teacher/groups"), api("/teacher/students"));
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
    $("#lastStatus").textContent = "Error";
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
        ${isTeacher() ? `
          <div class="card-actions">
            <button class="ghost-button" type="button" data-fill-assignment="${escapeHtml(assignment.id)}"><i data-lucide="square-pen"></i><span>Edit</span></button>
            <button class="ghost-button" type="button" data-missing-assignment="${escapeHtml(assignment.id)}"><i data-lucide="search"></i><span>Missing</span></button>
            <button class="danger-button" type="button" data-delete-assignment="${escapeHtml(assignment.id)}"><i data-lucide="trash-2"></i><span>Delete</span></button>
          </div>
        ` : ""}
      </article>
    `).join("")
    : emptyState("No homework yet. Teachers can create assignments here.");
}

function renderAssignments() {
  $("#assignmentsList").innerHTML = assignmentCards(state.assignments);
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
        ${submission.comment ? `<small class="meta">${escapeHtml(submission.comment)}</small>` : ""}
        ${(isTeacher() || admin) ? `
          <div class="card-actions">
            <button class="ghost-button" type="button" data-fill-grade="${escapeHtml(submission.assignment_id)}" data-student-id="${escapeHtml(submission.student_id)}"><i data-lucide="badge-check"></i><span>Grade</span></button>
            <button class="danger-button" type="button" data-delete-submission="${escapeHtml(submission.assignment_id)}" data-student-id="${escapeHtml(submission.student_id)}"><i data-lucide="trash-2"></i><span>Delete</span></button>
          </div>
        ` : ""}
      </article>
    `).join("")
    : emptyState("No uploaded files yet. Student submissions will appear here.");
}

function renderSubmissions() {
  $("#submissionsList").innerHTML = fileCards(state.submissions);
}

function renderTeacherTools() {
  if (!isTeacher()) return;
  const dashboard = state.teacher.dashboard || {};
  $("#teacherGroupCount").textContent = dashboard.groups ?? 0;
  $("#teacherStudentCount").textContent = dashboard.students ?? 0;
  $("#teacherAssignmentCount").textContent = dashboard.assignments ?? 0;
  $("#teacherUngradedCount").textContent = dashboard.ungraded_submissions ?? 0;
  $("#teacherStudentsList").innerHTML = state.teacher.students.length
    ? state.teacher.students.map(userCard).join("")
    : emptyState("No students in your groups yet.");
}

function renderAdminTools() {
  if (!isAdmin()) return;
  const stats = state.admin.stats || {};
  $("#adminUsersCount").textContent = stats.users ?? 0;
  $("#adminTeachersCount").textContent = stats.teachers ?? 0;
  $("#adminStudentsCount").textContent = stats.students ?? 0;
  $("#adminUngradedCount").textContent = stats.ungraded_submissions ?? 0;

  $("#adminUsersList").innerHTML = state.admin.users.length
    ? state.admin.users.map((user) => userCard(user, true)).join("")
    : emptyState("No users found.");

  $("#adminGroupsList").innerHTML = state.admin.groups.length
    ? state.admin.groups.map((group) => `
      <article class="item-card">
        <strong>${escapeHtml(group.name)}</strong>
        <small>Owner ${escapeHtml(group.owner_id)} - ${escapeHtml(group.member_count)} member(s)</small>
        <div class="pill-row">
          <span class="pill blue">ID ${escapeHtml(group.id)}</span>
          <span class="pill ${group.is_private ? "coral" : "green"}">${group.is_private ? "Private" : "Public"}</span>
        </div>
        <div class="card-actions">
          <button class="danger-button" type="button" data-delete-group="${escapeHtml(group.id)}"><i data-lucide="trash-2"></i><span>Delete group</span></button>
        </div>
      </article>
    `).join("")
    : emptyState("No groups found.");

  $("#adminAssignmentsList").innerHTML = state.admin.assignments.length
    ? assignmentCards(state.admin.assignments)
    : emptyState("No homework found.");

  $("#adminSubmissionsList").innerHTML = fileCards(state.admin.submissions, true, true);
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
        <div class="card-actions">
          <button class="ghost-button" type="button" data-fill-user="${escapeHtml(user.id)}"><i data-lucide="square-pen"></i><span>Edit</span></button>
          <button class="ghost-button" type="button" data-set-role="${escapeHtml(user.id)}" data-role="STUDENT"><i data-lucide="graduation-cap"></i><span>Student</span></button>
          <button class="ghost-button" type="button" data-set-role="${escapeHtml(user.id)}" data-role="TEACHER"><i data-lucide="presentation"></i><span>Teacher</span></button>
          <button class="ghost-button" type="button" data-set-role="${escapeHtml(user.id)}" data-role="ADMIN"><i data-lucide="shield"></i><span>Admin</span></button>
          <button class="danger-button" type="button" data-delete-user="${escapeHtml(user.id)}"><i data-lucide="trash-2"></i><span>Delete</span></button>
        </div>
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
      await refreshData();
      showToast("Student added");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#removeUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      await api(`/groups/${data.group_id}/users/${encodeURIComponent(data.user_id)}`, { method: "DELETE" });
      event.currentTarget.reset();
      await refreshData();
      showToast("Student removed");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#assignmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = readForm(event.currentTarget);
      if (!data.due_date) delete data.due_date;
      data.group_id = Number(data.group_id);
      await api("/assignments", { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("Homework created");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#assignmentUpdateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = compactPayload(readForm(event.currentTarget));
      const assignmentId = data.assignment_id;
      delete data.assignment_id;
      await api(`/assignments/${assignmentId}`, { method: "PUT", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("Homework updated");
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
      await renderMissingReport(data.assignment_id);
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

  $("#teacherStudentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = compactPayload(readForm(event.currentTarget));
      if (data.group_id) data.group_id = Number(data.group_id);
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

  $("#adminUpdateUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = compactPayload(readForm(event.currentTarget));
      const userId = data.user_id;
      delete data.user_id;
      await api(`/admin/users/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify(data) });
      event.currentTarget.reset();
      await refreshData();
      showToast("User updated");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  $("#refreshButton").addEventListener("click", refreshData);
  $("#logoutButton").addEventListener("click", clearSession);

  document.addEventListener("click", handleActionClick);
}

async function renderMissingReport(assignmentId) {
  const payload = await api(`/assignments/${assignmentId}/missing-submissions`);
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
}

async function handleActionClick(event) {
  const button = event.target.closest("button");
  if (!button || state.loading) return;

  try {
    if (button.dataset.roleFilter !== undefined) {
      state.admin.roleFilter = button.dataset.roleFilter;
      await refreshData();
      showToast(state.admin.roleFilter ? `Filtered ${state.admin.roleFilter.toLowerCase()} users` : "Showing all users");
    }

    if (button.dataset.fillUser) {
      const user = state.admin.users.find((item) => item.id === button.dataset.fillUser);
      if (user) {
        const form = $("#adminUpdateUserForm");
        form.elements.user_id.value = user.id;
        form.elements.user_name.value = user.user_name;
        form.elements.email.value = user.email;
        form.elements.role.value = user.role;
        form.elements.password.value = "";
      }
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

    if (button.dataset.fillAssignment) {
      const assignment = [...state.assignments, ...state.admin.assignments].find((item) => String(item.id) === String(button.dataset.fillAssignment));
      if (assignment) {
        const form = $("#assignmentUpdateForm");
        form.elements.assignment_id.value = assignment.id;
        form.elements.title.value = assignment.title || "";
        form.elements.due_date.value = assignment.due_date || "";
        form.elements.description.value = assignment.description || "";
        navigate("/homework");
      }
    }

    if (button.dataset.missingAssignment) {
      const form = $("#reportForm");
      form.elements.assignment_id.value = button.dataset.missingAssignment;
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
      form.elements.assignment_id.value = button.dataset.fillGrade;
      form.elements.student_id.value = button.dataset.studentId || "";
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

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindForms();
  navigate(normalizePath(location.pathname), true);
  updateShell();
  if (window.lucide) window.lucide.createIcons();
});
