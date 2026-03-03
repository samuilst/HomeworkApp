from marshmallow import Schema, validate, fields, ValidationError, validates
from password_strength import PasswordPolicy

policy = PasswordPolicy.from_names(
    length=10,
    uppercase=1,
    numbers=1,
    special=1,
)

class BaseUserSchema(Schema):
    email = fields.Email(required=True)
    user_name = fields.String(
        required=True,
        validate=validate.Length(min=2, max=10)
    )

class PasswordValidationMixin:
    password = fields.String(required=True, load_only=True)

    password_error = 'invalid password'

    @validates('password')
    def validate_password(self, value, **kwargs):
        errors = policy.test(value)
        if errors:
            raise ValidationError(self.password_error)
