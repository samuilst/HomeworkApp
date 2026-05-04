from marshmallow import Schema, fields, validate


class AssignmentCreateSchema(Schema):
    group_id = fields.Integer(required=True)
    title = fields.String(required=True, validate=validate.Length(min=1, max=255))
    description = fields.String(allow_none=True)
    due_date = fields.Date(required=False)


class AssignmentUpdateSchema(Schema):
    title = fields.String(validate=validate.Length(min=1, max=255))
    description = fields.String(allow_none=True)
    due_date = fields.Date(required=False)
