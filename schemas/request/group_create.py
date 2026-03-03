from flask_restful import fields
from marshmallow import Schema

class UserInGroupSchema(Schema):
    id = fields.String()
    user_name = fields.String()
    email = fields.String()
    role = fields.String(attribute="role. Value")


class GroupResponseSchema(Schema):
    name = fields.String(required=True)
    is_private = fields.Boolean()
    owner_id = fields.String()
    members = fields.List(fields.Nested(lambda: UserInGroupSchema()))

class AddUserSchema(Schema):
    user_id = fields.String()