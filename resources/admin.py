from flask import request
from flask_restful import Resource

from manager.admin import AdminManager, serialize_user
from manager.auth import auth
from schemas.admin import AdminUserCreateSchema, AdminUserUpdateSchema

create_user_schema = AdminUserCreateSchema()
update_user_schema = AdminUserUpdateSchema()


def serialize_group(group):
    return {
        "id": group.id,
        "name": group.name,
        "is_private": group.is_private,
        "owner_id": group.owner_id,
        "member_count": len(group.members),
    }


def serialize_assignment(assignment):
    return {
        "id": assignment.id,
        "title": assignment.title,
        "description": assignment.description,
        "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
        "group_id": assignment.group_id,
        "group_name": assignment.group.name if assignment.group else None,
        "created_by": assignment.created_by,
    }


def serialize_submission(submission):
    return {
        "submission_id": submission.submission_id,
        "assignment_id": submission.assignment_id,
        "assignment_title": submission.assignment.title if submission.assignment else None,
        "student_id": submission.student_id,
        "student_name": submission.student.user_name if submission.student else None,
        "file_path": submission.file_path,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "grade": submission.grade,
        "comment": submission.comment,
    }


class AdminUsersResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        role = request.args.get("role")
        users = AdminManager.list_users(current_user, role)
        return {"users": [serialize_user(user) for user in users]}, 200

    @auth.login_required
    def post(self):
        current_user = auth.current_user()
        data = create_user_schema.load(request.get_json() or {})
        user = AdminManager.create_user(data, current_user)
        return {"user": serialize_user(user)}, 201


class AdminUserDetailResource(Resource):
    @auth.login_required
    def get(self, user_id):
        current_user = auth.current_user()
        user = AdminManager.get_user(user_id, current_user)
        return {"user": serialize_user(user)}, 200

    @auth.login_required
    def put(self, user_id):
        current_user = auth.current_user()
        data = update_user_schema.load(request.get_json() or {})
        user = AdminManager.update_user(user_id, data, current_user)
        return {"user": serialize_user(user)}, 200

    @auth.login_required
    def delete(self, user_id):
        current_user = auth.current_user()
        AdminManager.delete_user(user_id, current_user)
        return {"message": "User deleted"}, 200


class AdminStatsResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        return AdminManager.stats(current_user), 200


class AdminGroupsResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        groups = AdminManager.list_groups(current_user)
        return {"groups": [serialize_group(group) for group in groups]}, 200


class AdminAssignmentsResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        assignments = AdminManager.list_assignments(current_user)
        return {"assignments": [serialize_assignment(assignment) for assignment in assignments]}, 200


class AdminSubmissionsResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        submissions = AdminManager.list_submissions(current_user)
        return {"submissions": [serialize_submission(submission) for submission in submissions]}, 200
