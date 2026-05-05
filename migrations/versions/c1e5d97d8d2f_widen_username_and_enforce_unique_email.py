"""Widen usernames and enforce unique email addresses

Revision ID: c1e5d97d8d2f
Revises: 8c0f8e23c8c4
Create Date: 2026-05-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c1e5d97d8d2f"
down_revision = "8c0f8e23c8c4"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "users",
        "user_name",
        existing_type=sa.String(length=10),
        type_=sa.String(length=50),
        existing_nullable=False,
    )
    op.create_unique_constraint("uq_users_email", "users", ["email"])


def downgrade():
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.alter_column(
        "users",
        "user_name",
        existing_type=sa.String(length=50),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
