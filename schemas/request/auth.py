from marshmallow import fields, validate

from models.enums import UserRoleEnum
from schemas.bases import PasswordValidationMixin, BaseUserSchema


class UserRegisterSchema(PasswordValidationMixin, BaseUserSchema):
    password_error = 'Password must contain uppercase, number and special symbol and be 10 characters long.!'
    role = fields.String(validate=validate.OneOf(
        [role.value for role in UserRoleEnum]
    ))

class  UserSignInSchema(PasswordValidationMixin, BaseUserSchema):
    password_error = 'Not a valid password!'