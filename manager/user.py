from werkzeug.security import generate_password_hash, check_password_hash

from db import db
from models.user import UserModel


class UserManager:

    @staticmethod
    def register(user_data):
        if UserModel.query.filter_by(email=user_data['email']).first():
            raise ValueError("Email already registered")

        if UserModel.query.filter_by(user_name=user_data['user_name']).first():
            raise ValueError("Username already registered")

        user_data['password'] = generate_password_hash(
            user_data['password'],
            method='pbkdf2:sha256'
        )

        user = UserModel(**user_data)
        db.session.add(user)
        db.session.commit()

        token = user.encode_token()

        return user

    @staticmethod
    def login(user_data):
        user = UserModel.query.filter_by(email=user_data['email']).first()

        if not user or not check_password_hash((user.password), user_data['password']):
            return {'message': 'Invalid password'}, 400

        return user

    @staticmethod
    def get_user_by_id(user_id):
        # @auth.login_required
        # # @permission_requred(UserRoleEnum.ADMIN)
        #     current_user = auth.current_user()

            return UserModel.query.filter_by(id=user_id).first()