# Run this alembic migration to add sources column to messages table
# Save this as: alembic/versions/xxxx_add_sources_to_messages.py

"""Add sources column to messages

Revision ID: add_sources_to_messages  # Change this to a unique ID
Revises: your_previous_revision  # Change this to your actual previous revision
Create Date: 2025-01-22 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql  # or mysql, sqlite depending on your DB

# revision identifiers, used by Alembic.
revision = 'add_sources_to_messages'  # Change this
down_revision = 'your_previous_revision'  # Change this to your last migration ID
branch_labels = None
depends_on = None

def upgrade():
    # Add sources and response_metadata columns to messages table
    op.add_column('messages', sa.Column('sources', sa.JSON, nullable=True))
    op.add_column('messages', sa.Column('response_metadata', sa.JSON, nullable=True))

def downgrade():
    # Remove sources and response_metadata columns
    op.drop_column('messages', 'response_metadata')
    op.drop_column('messages', 'sources')