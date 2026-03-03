from marshmallow import fields

from schemas.bases import BaseUserSchema


class UserResponseSchema(BaseUserSchema):
    id = fields.String(dump_only=True)
    role = fields.String(dump_only=True)
    created_on = fields.DateTime(dump_only=True)

