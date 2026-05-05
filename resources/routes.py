from resources.user import UserRegisterResource, UserRegistryResource, UserSignInResource

from resources.group import GroupListResource
from resources.group import GroupAddUserResource
from resources.group import GroupRemoveUserResource
from resources.group import GroupDetailResource
from resources.group import GroupDeleteResource

from resources.assignment import AssignmentCreateResource
from resources.assignment import AssignmentUpdateResource
from resources.assignment import AssignmentDeleteResource

from resources.submission import SubmissionCreateResource
from resources.submission import SubmissionDeleteResource
from resources.submission import SubmissionGradeResource
from resources.submission import MissingSubmissionsResource
from resources.submission import StudentSubmissionCountResource
from resources.submission import SubmissionFileResource
from resources.admin import AdminAssignmentsResource
from resources.admin import AdminGroupsResource
from resources.admin import AdminStatsResource
from resources.admin import AdminSubmissionsResource
from resources.admin import AdminUserDetailResource
from resources.admin import AdminUserRoleResource
from resources.admin import AdminUsersResource
from resources.teacher import TeacherDashboardResource
from resources.teacher import TeacherGroupsResource
from resources.teacher import TeacherStudentsResource

routes = (
    (UserRegistryResource, "/registry", "/register"),
    (UserSignInResource, "/login"),

    (GroupListResource, "/groups"),
    (GroupDetailResource, "/groups/<int:group_id>"),
    (GroupDeleteResource, "/groups/<int:group_id>"),

    (GroupAddUserResource, "/groups/<int:group_id>/users"),
    (GroupRemoveUserResource, "/groups/<int:group_id>/users/<string:user_id>"),

    (AssignmentCreateResource, "/assignments"),
    (AssignmentUpdateResource, "/assignments/<int:assignment_id>"),
    (AssignmentDeleteResource, "/assignments/<int:assignment_id>"),

    (SubmissionCreateResource, "/submissions"),
    (SubmissionDeleteResource, "/submissions"),
    (SubmissionFileResource, "/submissions/<int:submission_id>/file"),
    (SubmissionGradeResource, "/submissions/<int:assignment_id>/<string:student_id>"),
    (MissingSubmissionsResource, "/assignments/<int:assignment_id>/missing-submissions"),
    (StudentSubmissionCountResource, "/students/<string:student_id>/submission-count"),

    (AdminStatsResource, "/admin/stats"),
    (AdminUsersResource, "/admin/users"),
    (AdminUserDetailResource, "/admin/users/<string:user_id>"),
    (AdminUserRoleResource, "/admin/users/<string:user_id>/role"),
    (AdminGroupsResource, "/admin/groups"),
    (AdminAssignmentsResource, "/admin/assignments"),
    (AdminSubmissionsResource, "/admin/submissions"),

    (TeacherDashboardResource, "/teacher/dashboard"),
    (TeacherGroupsResource, "/teacher/groups"),
    (TeacherStudentsResource, "/teacher/students"),
)
