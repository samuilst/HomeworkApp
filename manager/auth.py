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
        try:
            payload = {
                'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2),
                'sub': user.id
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
            user = UserModel.query.get(result['sub'])
            if not user:
                raise jwt.exceptions.InvalidTokenError()
            return user
        except jwt.exceptions.InvalidTokenError as ex:
            raise Exception("Please login again")

    @auth.verify_token
    def verify_token(token):
        try:
            user = AuthManager.decode_token(token)
            return user
        except Exception:
            return None

    def permission_required(required_role):
        def decorator(function):
            def decorator_function(*args, **kwargs):
                current_user = auth.current_user()
                if current_user.role != required_role:
                    abort(403)
                return function(*args, **kwargs)

            return decorator_function

        return decorator


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
