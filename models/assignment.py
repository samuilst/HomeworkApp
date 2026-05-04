from db import db


class Assignment(db.Model):
    __tablename__ = "assignments"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    due_date = db.Column(db.Date)

    group_id = db.Column(db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    group = db.relationship("Group", back_populates="assignments")
    created_by = db.Column(db.String, db.ForeignKey("users.id"), nullable=False)
    created = db.relationship("UserModel")

