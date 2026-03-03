from db import db


class Group(db.Model):
    __tablename__ = "groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    is_private = db.Column(db.Boolean, default=False)
    owner_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=False)
    owner = db.relationship("UserModel")
