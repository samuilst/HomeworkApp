from marshmallow import Schema, fields
from marshmallow.validate import Length


class GroupCreateSchema(Schema):
    name = fields.String(required=True, validate=Length(min=1, max=255))
    is_private = fields.Boolean(required=False)


class GroupUserSchema(Schema):
    user_id = fields.String(required=True)
