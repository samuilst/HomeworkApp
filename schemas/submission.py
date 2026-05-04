from marshmallow import Schema, fields, validate


class SubmissionUploadSchema(Schema):
    assignment_id = fields.Integer(required=True)


class GradeSchema(Schema):
    grade = fields.Integer(required=True, validate=validate.Range(min=2, max=6))
    comment = fields.String(allow_none=True, load_default=None)


class SubmissionDeleteSchema(Schema):
    assignment_id = fields.Integer(required=True)
    student_id = fields.String(required=True)
