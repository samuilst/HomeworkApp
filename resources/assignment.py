from flask import request
from flask_restful import Resource

from manager.auth import auth
from manager.assignment import AssignmentManager
from schemas.assignment import AssignmentCreateSchema, AssignmentUpdateSchema

schema = AssignmentCreateSchema()
update_schema = AssignmentUpdateSchema()


class AssignmentCreateResource(Resource):

    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        group_id = request.args.get("group_id", type=int)
        assignments = AssignmentManager.list_assignments(current_user, group_id)
        return {
            "assignments": [
                {
                    "id": assignment.id,
                    "title": assignment.title,
                    "description": assignment.description,
                    "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                    "group_id": assignment.group_id,
                    "group_name": assignment.group.name,
                    "created_by": assignment.created_by,
                }
                for assignment in assignments
            ]
        }, 200

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
        data = update_schema.load(request.get_json() or {})

        assignment = AssignmentManager.update_assignment(
            assignment_id,
            data,
            current_user
        )

        return {"assignment_id": assignment.id}
