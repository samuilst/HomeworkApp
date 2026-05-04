from werkzeug.security import generate_password_hash

from db import db
from models.assignment import Assignment
from models.enums import UserRoleEnum
from models.group import Group
from models.submission import Submission
from models.user import UserModel


def require_admin(current_user):
    if current_user.role != UserRoleEnum.ADMIN:
        raise PermissionError("Admin access required")


def serialize_user(user):
    return {
        "id": user.id,
        "user_name": user.user_name,
        "email": user.email,
        "role": user.role.value,
        "created_on": user.created_on.isoformat() if user.created_on else None,
        "updated_on": user.updated_on.isoformat() if user.updated_on else None,
    }


class AdminManager:
    @staticmethod
    def list_users(current_user, role=None):
        require_admin(current_user)
        query = UserModel.query
        if role:
            query = query.filter_by(role=UserRoleEnum(role))
        return query.order_by(UserModel.created_on.desc()).all()

    @staticmethod
    def get_user(user_id, current_user):
        require_admin(current_user)
        user = UserModel.query.get(user_id)
        if not user:
            raise ValueError("User not found")
        return user

    @staticmethod
    def create_user(data, current_user):
        require_admin(current_user)

        if UserModel.query.filter_by(email=data["email"]).first():
            raise ValueError("Email already exists")
        if UserModel.query.filter_by(user_name=data["user_name"]).first():
            raise ValueError("Username already taken")

        user = UserModel(
            user_name=data["user_name"],
            email=data["email"],
            password=generate_password_hash(data["password"], method="pbkdf2:sha256"),
            role=UserRoleEnum(data["role"]),
        )
        db.session.add(user)
        db.session.commit()
        return user

    @staticmethod
    def update_user(user_id, data, current_user):
        require_admin(current_user)
        user = UserModel.query.get(user_id)
        if not user:
            raise ValueError("User not found")

        if "email" in data and data["email"] != user.email:
            if UserModel.query.filter_by(email=data["email"]).first():
                raise ValueError("Email already exists")
            user.email = data["email"]

        if "user_name" in data and data["user_name"] != user.user_name:
            if UserModel.query.filter_by(user_name=data["user_name"]).first():
                raise ValueError("Username already taken")
            user.user_name = data["user_name"]

        if "password" in data:
            user.password = generate_password_hash(data["password"], method="pbkdf2:sha256")

        if "role" in data:
            user.role = UserRoleEnum(data["role"])

        db.session.commit()
        return user

    @staticmethod
    def delete_user(user_id, current_user):
        require_admin(current_user)
        if current_user.id == user_id:
            raise ValueError("Admins cannot delete their own account")

        user = UserModel.query.get(user_id)
        if not user:
            raise ValueError("User not found")
        if Group.query.filter_by(owner_id=user_id).first():
            raise ValueError("Cannot delete a user who owns groups. Delete the groups first.")

        db.session.delete(user)
        db.session.commit()

    @staticmethod
    def stats(current_user):
        require_admin(current_user)
        return {
            "users": UserModel.query.count(),
            "admins": UserModel.query.filter_by(role=UserRoleEnum.ADMIN).count(),
            "teachers": UserModel.query.filter_by(role=UserRoleEnum.TEACHER).count(),
            "students": UserModel.query.filter_by(role=UserRoleEnum.STUDENT).count(),
            "groups": Group.query.count(),
            "assignments": Assignment.query.count(),
            "submissions": Submission.query.count(),
            "graded_submissions": Submission.query.filter(Submission.grade.isnot(None)).count(),
            "ungraded_submissions": Submission.query.filter(Submission.grade.is_(None)).count(),
        }

    @staticmethod
    def list_groups(current_user):
        require_admin(current_user)
        return Group.query.order_by(Group.id.desc()).all()

    @staticmethod
    def list_assignments(current_user):
        require_admin(current_user)
        return Assignment.query.order_by(Assignment.id.desc()).all()

    @staticmethod
    def list_submissions(current_user):
        require_admin(current_user)
        return Submission.query.order_by(Submission.submitted_at.desc()).all()
