from werkzeug.security import generate_password_hash

from db import db
from manager.admin import serialize_user
from models.assignment import Assignment
from models.enums import UserRoleEnum
from models.group import Group
from models.submission import Submission
from models.user import UserModel


def require_teacher_or_admin(current_user):
    if current_user.role not in (UserRoleEnum.TEACHER, UserRoleEnum.ADMIN):
        raise PermissionError("Teacher access required")


class TeacherManager:
    @staticmethod
    def owned_groups(current_user):
        require_teacher_or_admin(current_user)
        if current_user.role == UserRoleEnum.ADMIN:
            return Group.query.order_by(Group.id.desc()).all()
        return Group.query.filter_by(owner_id=current_user.id).order_by(Group.id.desc()).all()

    @staticmethod
    def students(current_user):
        require_teacher_or_admin(current_user)
        students_by_id = {}
        for group in TeacherManager.owned_groups(current_user):
            for member in group.members:
                if member.role == UserRoleEnum.STUDENT:
                    students_by_id[member.id] = member
        return list(students_by_id.values())

    @staticmethod
    def create_student(data, current_user):
        require_teacher_or_admin(current_user)

        if UserModel.query.filter_by(email=data["email"]).first():
            raise ValueError("Email already exists")
        if UserModel.query.filter_by(user_name=data["user_name"]).first():
            raise ValueError("Username already taken")

        student = UserModel(
            user_name=data["user_name"],
            email=data["email"],
            password=generate_password_hash(data["password"], method="pbkdf2:sha256"),
            role=UserRoleEnum.STUDENT,
        )

        group_id = data.get("group_id")
        if group_id:
            group = Group.query.get(group_id)
            if not group:
                raise ValueError("Group not found")
            if current_user.role != UserRoleEnum.ADMIN and group.owner_id != current_user.id:
                raise PermissionError("Not your group")
            group.members.append(student)

        db.session.add(student)
        db.session.commit()
        return student

    @staticmethod
    def dashboard(current_user):
        require_teacher_or_admin(current_user)
        groups = TeacherManager.owned_groups(current_user)
        group_ids = [group.id for group in groups]
        assignments = Assignment.query.filter(Assignment.group_id.in_(group_ids)).all() if group_ids else []
        assignment_ids = [assignment.id for assignment in assignments]
        submissions = Submission.query.filter(Submission.assignment_id.in_(assignment_ids)).all() if assignment_ids else []

        return {
            "groups": len(groups),
            "students": len(TeacherManager.students(current_user)),
            "assignments": len(assignments),
            "submissions": len(submissions),
            "ungraded_submissions": len([submission for submission in submissions if submission.grade is None]),
        }

    @staticmethod
    def serialize_students(current_user):
        return [serialize_user(student) for student in TeacherManager.students(current_user)]
