from marshmallow import Schema, fields


class SubmissionCreateSchema(Schema):
    assignment_id = fields.Integer(required=True)
    file_path = fields.String(required=True)


class GradeSchema(Schema):
    grade = fields.String(required=True)
    comment = fields.String()