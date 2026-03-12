from flask import request
from flask_restful import Resource

from manager.auth import auth
from manager.assignment import AssignmentManager
from schemas.assignment import AssignmentCreateSchema

schema = AssignmentCreateSchema()


class AssignmentCreateResource(Resource):

    @auth.login_required
    def post(self):

        current_user = auth.current_user()
        data = schema.load(request.get_json())

        assignment = AssignmentManager.create_assignment(
            data,
            current_user
        )

        return {"assignment_id": assignment.id}, 201

class AssignmentDeleteResource(Resource):

    @auth.login_required
    def delete(self, assignment_id):

        current_user = auth.current_user()

        AssignmentManager.delete_assignment(
            assignment_id,
            current_user
        )

        return {"message": "Assignment deleted"}

class AssignmentUpdateResource(Resource):

    @auth.login_required
    def put(self, assignment_id):

        current_user = auth.current_user()
        data = request.get_json()

        assignment = AssignmentManager.update_assignment(
            assignment_id,
            data,
            current_user
        )

        return {"assignment_id": assignment.id}