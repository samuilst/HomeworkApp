import datetime
import uuid
from sqlalchemy import func

from db import db
from models.enums import UserRoleEnum


class UserModel(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_name = db.Column(db.String(10), unique=True, nullable=False)
    email = db.Column(db.String, nullable=False)
    password = db.Column(db.String, nullable=False)
    role = db.Column(db.Enum(UserRoleEnum), nullable=False, default=UserRoleEnum.STUDENT)
    created_on = db.Column(db.DateTime, nullable=False, default=datetime.datetime.now(datetime.timezone.utc))
    #     default_server
    updated_on = db.Column(db.DateTime, nullable=False, server_default=func.now())



