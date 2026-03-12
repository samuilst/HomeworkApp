from flask import request
from flask_restful import Resource

from manager.auth import auth
from manager.submission import SubmissionManager
from schemas.submission import SubmissionCreateSchema

schema = SubmissionCreateSchema()


class SubmissionCreateResource(Resource):

    @auth.login_required
    def post(self):

        current_user = auth.current_user()
        data = schema.load(request.get_json())

        submission = SubmissionManager.submit_homework(
            data["file_path"],
            data["assignment_id"],
            current_user
        )

        # return {"submission_id": submission.submission_id}
        return {"submission_id": submission.id}

class SubmissionDeleteResource(Resource):

    @auth.login_required
    def delete(self):

        current_user = auth.current_user()
        data = request.get_json()

        SubmissionManager.delete_submission(
            data["assignment_id"],
            data["student_id"],
            current_user
        )

        return {"message": "Submission deleted"}, 200

class SubmissionGradeResource(Resource):

    @auth.login_required
    def put(self, assignment_id, student_id):

        current_user = auth.current_user()
        data = schema.load(request.get_json())

        submission = SubmissionManager.grade_submission(
            assignment_id,
            student_id,
            data["grade"],
            data["comment"],
            current_user
        )

        return {"grade": submission.grade}