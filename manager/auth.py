import datetime

from decouple import config
from flask import request
from flask_restful import abort
# from jwt import jwt
from flask_httpauth import HTTPTokenAuth
import jwt
from db import db
from models.user import UserModel

auth = HTTPTokenAuth(scheme='Bearer')

class AuthManager:

    @staticmethod
    def encode_token(self):
        try:
            payload = {
                # changed datetime.utcnow() -> datetime.datetime.now(datetime.timezone.utc)
                'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2),
                'sub': self.id
            }
            return jwt.encode(
                payload,
                key=config('SECRET_KEY'),
                algorithm='HS256')
        except Exception as e:
            raise e

    @staticmethod
    def decode_token(token):
        try:
            result = jwt.decode(jwt=token, key=config('SECRET_KEY'), algorithms=['HS256'])
            user = db.session.execute(db.selector(UserModel).filter_by(id=result['sub'])).scalar()
            # user = UserModel.query.filter_by(id=result['sub']).first()
            if not user:
                raise jwt.exceptions.InvalidTokenError()
            return user
        except jwt.exceptions.InvalidTokenError as ex:
            raise Exception("Please login again")

    @auth.verify_token
    def verify_token(self, token):
        try:
            user_id = self.decode_token(token)
            return UserModel.query.filter_by(id=user_id).first()
        except Exception:
            return None

    def permission_required(requred_role):
        def decorator(function):
            def decorator_function(*args, **kwargs):
                current_user = auth.current_user()
                if current_user.role != requred_role:
                    abort(403)
                return function(*args, **kwargs)

            return decorator_function

        return decorator


def validate_schema(schema):
    def decorator(function):
        def decorator_function(*args, **kwargs):
            schema_obj = schema
            data = request.get_json()
            error = schema_obj.validate(data)
            if error:
                abort(400)
            return function(*args, **kwargs)

        return decorator_function

    return decorator