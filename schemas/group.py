from marshmallow import Schema, fields


class GroupCreateSchema(Schema):
    name = fields.String(required=True)
    is_private = fields.Boolean(required=False)


class GroupUserSchema(Schema):
    user_id = fields.Integer(required=True)