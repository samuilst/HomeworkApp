from db import db
from datetime import datetime

class Submission(db.Model):
    __tablename__ = "submissions"

    submission_id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(500), nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Integer)
    comment = db.Column(db.Text)

    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id", ondelete="CASCADE"))
    assignment = db.relationship("Assignment")
    student_id = db.Column(db.String, db.ForeignKey("users.id", ondelete="CASCADE"))
    student = db.relationship("UserModel")