from flask import request
from flask_restful import Resource

from manager.admin import serialize_user
from manager.auth import auth
from manager.teacher import TeacherManager
from resources.admin import serialize_group
from schemas.admin import TeacherStudentCreateSchema

student_create_schema = TeacherStudentCreateSchema()


class TeacherDashboardResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        return TeacherManager.dashboard(current_user), 200


class TeacherGroupsResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        groups = TeacherManager.owned_groups(current_user)
        return {"groups": [serialize_group(group) for group in groups]}, 200


class TeacherStudentsResource(Resource):
    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        return {"students": TeacherManager.serialize_students(current_user)}, 200

    @auth.login_required
    def post(self):
        current_user = auth.current_user()
        data = student_create_schema.load(request.get_json() or {})
        student = TeacherManager.create_student(data, current_user)
        return {"student": serialize_user(student)}, 201
