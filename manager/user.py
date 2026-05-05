from models.user import UserModel


class UserManager:
    @staticmethod
    def get_user_by_id(user_id):
        return UserModel.query.filter_by(id=user_id).first()
