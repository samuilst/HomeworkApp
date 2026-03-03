from db import db

group_users = db.Table(
    "group_users",
    db.Column("group_id", db.Integer, db.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    db.Column("user_id", db.String, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)