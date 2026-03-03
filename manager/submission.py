import datetime

from sqlalchemy.exc import IntegrityError

from db import db
from models.assignment import Assignment
from models.group_user import GroupUser
from models.submission import Submission


class SubmissionManager:

    @staticmethod
    def submit_homework(file_path, assignment_id, current_user):
        if current_user.role != "student":
            raise PermissionError("Only students can submit")

        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            raise ValueError("Assignment not found")

        membership = GroupUser.query.filter_by(
            group_id=assignment.group_id,
            user_id=current_user.id
        ).first()

        if not membership:
            raise PermissionError("Student not in group")

        submission = Submission(
            assignment_id=assignment_id,
            student_id=current_user.id,
            file_path=file_path,
            submitted_at=datetime.utcnow()
        )

        try:
            db.session.add(submission)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError("Submission already exists")

        return submission

    @staticmethod
    def grade_submission(assignment_id, student_id, grade, comment, current_user):
        if current_user.role != "teacher":
            raise PermissionError("Only teachers can grade")

        if grade < 2 or grade > 6:
            raise ValueError("Grade must be between 2 and 6")

        submission = Submission.query.filter_by(
            assignment_id=assignment_id,
            student_id=student_id
        ).first()

        if not submission:
            raise ValueError("Submission not found")

        submission.grade = grade
        submission.comment = comment

        db.session.commit()
        return submission

    @staticmethod
    def delete_submission(assignment_id, student_id, current_user):
        submission = Submission.query.filter_by(
            assignment_id=assignment_id,
            student_id=student_id
        ).first()

        if not submission:
            raise ValueError("Submission not found")

        if current_user.role != "admin" and submission.student_id != current_user.id:
            raise PermissionError("Not allowed")

        db.session.delete(submission)
        db.session.commit()