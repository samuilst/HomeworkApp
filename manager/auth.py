import datetime
from functools import wraps

from decouple import config
from flask import request
from flask_restful import abort
from flask_httpauth import HTTPTokenAuth
import jwt
from db import db
from models.user import UserModel

auth = HTTPTokenAuth(scheme='Bearer')

class AuthManager:

    @staticmethod
    def encode_token(user):
        payload = {
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2),
            'sub': str(user.id)
        }
        return jwt.encode(
            payload,
            key=config('SECRET_KEY'),
            algorithm='HS256')

    @staticmethod
    def decode_token(token):
        try:
            result = jwt.decode(jwt=token, key=config('SECRET_KEY'), algorithms=['HS256'])
            user_id = result.get('sub')
            if not user_id:
                raise jwt.exceptions.InvalidTokenError()
            user = db.session.get(UserModel, user_id)
            if not user:
                raise jwt.exceptions.InvalidTokenError()
            return user
        except jwt.exceptions.InvalidTokenError:
            raise Exception("Please login again")

    @staticmethod
    def permission_required(required_role):
        def decorator(function):
            @wraps(function)
            def decorator_function(*args, **kwargs):
                current_user = auth.current_user()
                if not current_user or current_user.role != required_role:
                    abort(403)
                return function(*args, **kwargs)

            return decorator_function

        return decorator


@auth.verify_token
def verify_token(token):
    try:
        user = AuthManager.decode_token(token)
        return user
    except Exception:
        return None


@auth.error_handler
def auth_error(status):
    return {"message": "Unauthorized. Please sign in again."}, status


def validate_schema(schema):
    def decorator(function):
        @wraps(function)
        def decorator_function(*args, **kwargs):
            schema_obj = schema
            data = request.get_json(silent=True) or {}
            error = schema_obj.validate(data)
            if error:
                abort(400, message="Validation error", errors=error)
            return function(*args, **kwargs)

        return decorator_function

    return decorator
