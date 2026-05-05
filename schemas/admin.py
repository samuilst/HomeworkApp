from marshmallow import Schema, fields, validate

from models.enums import UserRoleEnum
from schemas.bases import PasswordValidationMixin, BaseUserSchema


class AdminUserCreateSchema(PasswordValidationMixin, BaseUserSchema):
    role = fields.String(
        required=True,
        validate=validate.OneOf([role.value for role in UserRoleEnum]),
    )


class AdminUserUpdateSchema(Schema):
    user_name = fields.String(validate=validate.Length(min=2, max=50))
    email = fields.Email()
    password = fields.String(load_only=True)
    role = fields.String(validate=validate.OneOf([role.value for role in UserRoleEnum]))


class AdminUserRoleUpdateSchema(Schema):
    role = fields.String(
        required=True,
        validate=validate.OneOf([role.value for role in UserRoleEnum]),
    )


class TeacherStudentCreateSchema(PasswordValidationMixin, BaseUserSchema):
    group_id = fields.Integer(required=False, allow_none=True)
