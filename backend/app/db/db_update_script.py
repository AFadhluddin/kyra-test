# Alembic migration script for conversational features
"""Add conversational features and GPT-4o fallback support

Revision ID: add_conversational_features
Revises: previous_revision
Create Date: 2025-07-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'add_conversational_features'
down_revision = 'previous_revision'  # Replace with your last revision
branch_labels = None
depends_on = None

def upgrade():
    # Create ResponseType enum
    response_type_enum = postgresql.ENUM(
        'rag_success', 
        'rag_fallback', 
        'gpt4o_response', 
        'error',
        name='responsetype'
    )
    response_type_enum.create(op.get_bind())
    
    # Add user preferences
    op.add_column('users', sa.Column('prefer_detailed_responses', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('allow_gpt4o_fallback', sa.Boolean(), server_default='true', nullable=False))
    
    # Add session context fields
    op.add_column('chat_sessions', sa.Column('context_summary', sa.Text(), nullable=True))
    op.add_column('chat_sessions', sa.Column('last_topic', sa.String(500), nullable=True))
    op.add_column('chat_sessions', sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))
    
    # Add message metadata fields
    op.add_column('messages', sa.Column('response_type', response_type_enum, nullable=True))
    op.add_column('messages', sa.Column('confidence_score', sa.Float(), nullable=True))
    op.add_column('messages', sa.Column('sources', sa.JSON(), nullable=True))
    op.add_column('messages', sa.Column('processing_time_ms', sa.Integer(), nullable=True))
    
    # Convert UnansweredQuery to use new Mapped style and add new fields
    # First, add the new columns
    op.add_column('unanswered_queries', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('unanswered_queries', sa.Column('session_id', sa.Integer(), nullable=True))
    op.add_column('unanswered_queries', sa.Column('context_provided', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('unanswered_queries', sa.Column('resolved_with_gpt4o', sa.Boolean(), server_default='false', nullable=False))
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_unanswered_queries_user_id',
        'unanswered_queries', 'users',
        ['user_id'], ['id']
    )
    op.create_foreign_key(
        'fk_unanswered_queries_session_id', 
        'unanswered_queries', 'chat_sessions',
        ['session_id'], ['id']
    )
    
    # Add relationship foreign key for messages to sessions (if not exists)
    try:
        op.create_foreign_key(
            'fk_messages_session_id',
            'messages', 'chat_sessions',
            ['session_id'], ['id']
        )
    except Exception:
        # Foreign key might already exist
        pass
    
    # Add indexes for better performance
    op.create_index('idx_messages_session_created', 'messages', ['session_id', 'created_at'])
    op.create_index('idx_sessions_user_updated', 'chat_sessions', ['user_id', 'updated_at'])
    op.create_index('idx_unanswered_queries_user_created', 'unanswered_queries', ['user_id', 'created_at'])

def downgrade():
    # Remove indexes
    op.drop_index('idx_unanswered_queries_user_created', 'unanswered_queries')
    op.drop_index('idx_sessions_user_updated', 'chat_sessions')
    op.drop_index('idx_messages_session_created', 'messages')
    
    # Remove foreign key constraints
    op.drop_constraint('fk_unanswered_queries_session_id', 'unanswered_queries', type_='foreignkey')
    op.drop_constraint('fk_unanswered_queries_user_id', 'unanswered_queries', type_='foreignkey')
    
    # Remove new columns from unanswered_queries
    op.drop_column('unanswered_queries', 'resolved_with_gpt4o')
    op.drop_column('unanswered_queries', 'context_provided')
    op.drop_column('unanswered_queries', 'session_id')
    op.drop_column('unanswered_queries', 'user_id')
    
    # Remove message metadata fields
    op.drop_column('messages', 'processing_time_ms')
    op.drop_column('messages', 'sources')
    op.drop_column('messages', 'confidence_score')
    op.drop_column('messages', 'response_type')
    
    # Remove session context fields
    op.drop_column('chat_sessions', 'updated_at')
    op.drop_column('chat_sessions', 'last_topic')
    op.drop_column('chat_sessions', 'context_summary')
    
    # Remove user preferences
    op.drop_column('users', 'allow_gpt4o_fallback')
    op.drop_column('users', 'prefer_detailed_responses')
    
    # Drop the enum type
    response_type_enum = postgresql.ENUM(name='responsetype')
    response_type_enum.drop(op.get_bind())