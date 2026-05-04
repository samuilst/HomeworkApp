"""Add unique submission per assignment/student

Revision ID: 8c0f8e23c8c4
Revises: 3bffaae8c382
Create Date: 2026-05-03 20:00:00.000000

"""
from alembic import op


revision = "8c0f8e23c8c4"
down_revision = "3bffaae8c382"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(
        "uq_submission_assignment_student",
        "submissions",
        ["assignment_id", "student_id"],
    )


def downgrade():
    op.drop_constraint(
        "uq_submission_assignment_student",
        "submissions",
        type_="unique",
    )
