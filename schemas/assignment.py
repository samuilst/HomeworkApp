from marshmallow import Schema, fields


class AssignmentCreateSchema(Schema):
    group_id = fields.Integer(required=True)
    title = fields.String(required=True)
    description = fields.String()
    due_date = fields.DateTime(required=False)