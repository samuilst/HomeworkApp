from flask import request
from flask_restful import Resource
from werkzeug.security import generate_password_hash, check_password_hash

from db import db
from manager.auth import auth, validate_schema
from manager.auth import AuthManager
from models.enums import UserRoleEnum
from models.user import UserModel

from schemas.request.auth import UserRegisterSchema, UserSignInSchema


def serialize_auth_user(user):
    return {
        "user_id": user.id,
        "user_name": user.user_name,
        "email": user.email,
        "role": user.role.value,
    }


class UserRegistryResource(Resource):
    @validate_schema(UserRegisterSchema())
    def post(self):
        data = request.get_json()

        # if (UserModel.query.filter_by(email=data['email']).first()):
        #     return {'message': 'Invalid email'}, 400

        if UserModel.query.filter_by(email=data['email']).first():
            return {'message': 'Email already exists'}, 400

        if UserModel.query.filter_by(user_name=data['user_name']).first():
            return {'message': 'Username already taken'}, 400

        data['password'] = generate_password_hash(
            data['password'],
            method='pbkdf2:sha256'
        )
        data["role"] = UserRoleEnum.STUDENT

        user = UserModel(**data)
        db.session.add(user)
        db.session.commit()

        token = user.encode_token()

        return {
            "token": token,
            "user": serialize_auth_user(user),
            "message": "User registered successfully!",
            "user_id": user.id,
            "user_name": user.user_name,
            "email": user.email,
            "role": user.role.value,

        }, 201


class UserRegisterResource(UserRegistryResource):
    pass


class UserSignInResource(Resource):
    @validate_schema(UserSignInSchema())
    def post(self):
        data = request.get_json()

        # schema = UserSignInSchema()
        # errors = schema.validate(data)
        # if (errors):
        #     return {'errors': errors}, 400

        user = UserModel.query.filter_by(email=data['email']).first()

        if not user or not check_password_hash((user.password), data['password']):
            return {'message': 'Invalid email or password'}, 401

        return {
            "message": "User logged in successfully!",
            "token": AuthManager.encode_token(user),
            "user": serialize_auth_user(user),
            "user_id": user.id,
            "user_name": user.user_name,
            "email": user.email,
            'role': user.role.value
        }, 200

    @auth.login_required
    # @permission_requred(UserRoleEnum.ADMIN)
    def get(self):
        current_user = auth.current_user()

        return {
            "message": "User profile retrieved successfully",
            "user_id": current_user.id,
            "user_name": current_user.user_name,
            "email": current_user.email,
            "role": current_user.role.value,
        }, 200
