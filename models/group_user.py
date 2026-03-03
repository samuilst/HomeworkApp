from db import db


class GroupUser(db.Model):
    __tablename__ = "group_users"

    group_id = db.Column( db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    group = db.relationship("Group")
    user_id = db.Column(db.String, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    user = db.relationship('UserModel')

    # group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), primary_key=True)
    # user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)