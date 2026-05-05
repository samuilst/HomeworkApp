from marshmallow import Schema, fields

from schemas.bases import PasswordValidationMixin, BaseUserSchema


class UserRegisterSchema(PasswordValidationMixin, BaseUserSchema):
    password_error = 'Password must be at least 10 characters and include an uppercase letter, a number, and a special character.'

class UserSignInSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
