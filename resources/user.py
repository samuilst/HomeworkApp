from flask import request
from flask_restful import Resource
from werkzeug.security import generate_password_hash, check_password_hash

from db import db
from manager.auth import auth, validate_schema
from models.user import UserModel

from schemas.request.auth import UserRegisterSchema, UserSignInSchema


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

        user = UserModel(**data)
        db.session.add(user)
        db.session.commit()

        token = user.encode_token()

        return {
            "token": token,
            "message": "User registered successfully!",
            "user_id": user.id

        }, 201


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
            return {'message': 'Invalid password'}, 400

        return {
            "message": "User login successfully!",
            "user_id": user.id,
            'role': user.role.value
        }, 200

    @auth.login_required
    # @permission_requred(UserRoleEnum.ADMIN)
    def get(self):
        current_user = auth.current_user()

        return {
            "message": "User profile retrieved seccesufully",
            "user_id": current_user.id,
            "user_name": current_user.user_name,
        }, 200
