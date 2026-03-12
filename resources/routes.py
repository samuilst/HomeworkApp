from resources.user import UserRegistryResource, UserSignInResource

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

routes = (
    (UserRegistryResource, "/registry"),
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
    (SubmissionGradeResource, "/submissions/<int:assignment_id>/<string:student_id>")
)