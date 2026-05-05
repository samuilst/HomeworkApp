"""Add unique user email constraint

Revision ID: f45b9c1d7a2e
Revises: 8c0f8e23c8c4
Create Date: 2026-05-05 22:30:00.000000

"""
from alembic import op


revision = "f45b9c1d7a2e"
down_revision = "8c0f8e23c8c4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint("uq_users_email", "users", ["email"])


def downgrade():
    op.drop_constraint("uq_users_email", "users", type_="unique")
