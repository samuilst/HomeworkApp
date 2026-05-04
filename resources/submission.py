from flask import request
from flask_restful import Resource
from marshmallow import ValidationError

from manager.auth import auth
from manager.submission import SubmissionManager
from schemas.submission import GradeSchema, SubmissionDeleteSchema, SubmissionUploadSchema

upload_schema = SubmissionUploadSchema()
grade_schema = GradeSchema()
delete_schema = SubmissionDeleteSchema()


class SubmissionCreateResource(Resource):

    @auth.login_required
    def get(self):
        current_user = auth.current_user()
        assignment_id = request.args.get("assignment_id", type=int)
        submissions = SubmissionManager.list_submissions(current_user, assignment_id)
        return {
            "submissions": [
                {
                    "submission_id": submission.submission_id,
                    "assignment_id": submission.assignment_id,
                    "assignment_title": submission.assignment.title,
                    "student_id": submission.student_id,
                    "student_name": submission.student.user_name,
                    "file_path": submission.file_path,
                    "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                    "grade": submission.grade,
                    "comment": submission.comment,
                }
                for submission in submissions
            ]
        }, 200

    @auth.login_required
    def post(self):

        current_user = auth.current_user()
        data = upload_schema.load(request.form.to_dict())
        uploaded_file = request.files.get("file")
        if not uploaded_file:
            raise ValidationError({"file": ["Missing uploaded file."]})

        submission = SubmissionManager.submit_homework(
            uploaded_file,
            data["assignment_id"],
            current_user
        )

        return {
            "submission_id": submission.submission_id,
            "file_path": submission.file_path,
            "message": "Submission uploaded successfully"
        }, 201

class SubmissionDeleteResource(Resource):

    @auth.login_required
    def delete(self):

        current_user = auth.current_user()
        data = delete_schema.load(request.get_json() or {})

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
        data = grade_schema.load(request.get_json() or {})

        submission = SubmissionManager.grade_submission(
            assignment_id,
            student_id,
            data["grade"],
            data["comment"],
            current_user
        )

        return {"grade": submission.grade}


class MissingSubmissionsResource(Resource):

    @auth.login_required
    def get(self, assignment_id):
        current_user = auth.current_user()
        return SubmissionManager.missing_students_report(assignment_id, current_user), 200


class StudentSubmissionCountResource(Resource):

    @auth.login_required
    def get(self, student_id):
        current_user = auth.current_user()
        return SubmissionManager.student_submission_count(student_id, current_user), 200
