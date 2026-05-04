from marshmallow import Schema, fields

from schemas.bases import PasswordValidationMixin, BaseUserSchema


class UserRegisterSchema(PasswordValidationMixin, BaseUserSchema):
    password_error = 'Password must contain uppercase, number and special symbol and be 10 characters long.!'

class UserSignInSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
