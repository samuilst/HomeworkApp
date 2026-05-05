import datetime

from sqlalchemy.exc import IntegrityError

from db import db
from models.assignment import Assignment
from models.enums import UserRoleEnum
from models.submission import Submission
from models.user import UserModel
from manager.s3_storage import S3Storage


class SubmissionManager:
    @staticmethod
    def list_submissions(current_user, assignment_id=None):
        query = Submission.query
        if assignment_id:
            query = query.filter_by(assignment_id=assignment_id)

        submissions = query.order_by(Submission.submitted_at.desc()).all()
        visible = []
        for submission in submissions:
            assignment = submission.assignment
            group = assignment.group
            can_see = (
                current_user.role == UserRoleEnum.ADMIN
                or submission.student_id == current_user.id
                or assignment.created_by == current_user.id
                or (current_user.role == UserRoleEnum.TEACHER and not group.is_private)
            )
            if can_see:
                visible.append(submission)

        return visible

    @staticmethod
    def submit_homework(file_storage, assignment_id, current_user):
        if current_user.role != UserRoleEnum.STUDENT:
            raise PermissionError("Only students can submit")

        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            raise ValueError("Assignment not found")

        group = assignment.group

        if current_user not in group.members:
            raise PermissionError("Student not in group")

        uploaded_file_path = S3Storage.upload(
            file_storage,
            f"assignments/{assignment_id}/students/{current_user.id}"
        )

        submission = Submission.query.filter_by(
            assignment_id=assignment_id,
            student_id=current_user.id
        ).first()
        old_file_path = submission.file_path if submission else None

        try:
            if submission:
                submission.file_path = uploaded_file_path
                submission.submitted_at = datetime.datetime.utcnow()
            else:
                submission = Submission(
                    assignment_id=assignment_id,
                    student_id=current_user.id,
                    file_path=uploaded_file_path,
                    submitted_at=datetime.datetime.utcnow()
                )
                db.session.add(submission)

            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            S3Storage.delete(uploaded_file_path)
            raise ValueError("Submission already exists")
        except Exception:
            db.session.rollback()
            S3Storage.delete(uploaded_file_path)
            raise

        if old_file_path:
            S3Storage.delete(old_file_path)

        return submission

    @staticmethod
    def grade_submission(assignment_id, student_id, grade, comment, current_user):
        if current_user.role not in (UserRoleEnum.TEACHER, UserRoleEnum.ADMIN):
            raise PermissionError("Only teachers can grade")

        if grade < 2 or grade > 6:
            raise ValueError("Grade must be between 2 and 6")

        submission = Submission.query.filter_by(
            assignment_id=assignment_id,
            student_id=student_id
        ).first()

        if not submission:
            raise ValueError("Submission not found")

        if current_user.role != UserRoleEnum.ADMIN and submission.assignment.created_by != current_user.id:
            raise PermissionError("Not your assignment")

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

        if current_user.role != UserRoleEnum.ADMIN and submission.student_id != current_user.id:
            raise PermissionError("Not allowed")

        file_path = submission.file_path
        db.session.delete(submission)
        db.session.commit()
        S3Storage.delete(file_path)

    @staticmethod
    def missing_students_report(assignment_id, current_user):
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            raise ValueError("Assignment not found")

        group = assignment.group
        allowed = (
            current_user.role == UserRoleEnum.ADMIN
            or assignment.created_by == current_user.id
            or (not group.is_private and current_user.role == UserRoleEnum.TEACHER)
        )
        if not allowed:
            raise PermissionError("Not allowed")

        submitted_student_ids = {
            row.student_id
            for row in Submission.query.with_entities(Submission.student_id)
            .filter_by(assignment_id=assignment_id)
            .all()
        }
        missing_students = [
            user
            for user in group.members
            if user.role == UserRoleEnum.STUDENT and user.id not in submitted_student_ids
        ]

        return {
            "assignment_id": assignment.id,
            "assignment_title": assignment.title,
            "group_id": group.id,
            "group_name": group.name,
            "submitted_count": len(submitted_student_ids),
            "missing_count": len(missing_students),
            "missing_students": [
                {
                    "id": user.id,
                    "user_name": user.user_name,
                    "email": user.email,
                }
                for user in missing_students
            ],
        }

    @staticmethod
    def student_submission_count(student_id, current_user):
        if current_user.role == UserRoleEnum.STUDENT and current_user.id != student_id:
            raise PermissionError("Not allowed")

        student = UserModel.query.get(student_id)
        if not student or student.role != UserRoleEnum.STUDENT:
            raise ValueError("Student not found")

        count = Submission.query.filter_by(student_id=student_id).count()
        return {
            "student_id": student.id,
            "user_name": student.user_name,
            "submission_count": count,
        }
