import enum


class UserRoleEnum(enum.Enum):
    ADMIN = 'ADMIN'
    TEACHER = 'TEACHER'
    STUDENT = 'STUDENT'