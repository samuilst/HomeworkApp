from schemas.bases import PasswordValidationMixin, BaseUserSchema


class UserRegisterSchema(PasswordValidationMixin, BaseUserSchema):
    password_error = 'Password must contain uppercase, number and special symbol and be 10 characters long.!'

class  UserSignInSchema(PasswordValidationMixin, BaseUserSchema):
    password_error = 'Not a valid password!'
