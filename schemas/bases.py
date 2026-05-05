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
        validate=validate.Length(min=2, max=50)
    )

class PasswordValidationMixin:
    password = fields.String(required=True, load_only=True)

    password_error = 'Password must be at least 10 characters and include an uppercase letter, a number, and a special character.'

    @validates('password')
    def validate_password(self, value, **kwargs):
        errors = policy.test(value)
        if errors:
            raise ValidationError(self.password_error)
