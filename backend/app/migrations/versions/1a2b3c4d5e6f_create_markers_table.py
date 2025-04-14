"""create_markers_table

Revision ID: 1a2b3c4d5e6f
Revises: previous_revision_id
Create Date: 2025-04-12 17:28:00.000000

"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import ARRAY, JSON

# revision identifiers, used by Alembic.
revision = '1a2b3c4d5e6f'
down_revision = 'previous_revision_id'  # Update this with the actual previous revision ID
branch_labels = None
depends_on = None

def upgrade():
    # Create PostGIS extension if not exists
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    
    # Create markers table
    op.create_table(
        'markers',
        sa.Column('marker_id', sa.Integer(), nullable=False),
        sa.Column('donator_user_id', sa.Integer(), nullable=False),
        sa.Column('receiver_user_id', sa.Integer(), nullable=True),
        sa.Column('location', Geometry('POINT', srid=4326), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('creation_date', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('food_display_info', JSON, nullable=False),
        sa.Column('dietary_tags', ARRAY(sa.String()), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.PrimaryKeyConstraint('marker_id'),
        sa.ForeignKeyConstraint(['donator_user_id'], ['users.user_id'], ),
        sa.ForeignKeyConstraint(['receiver_user_id'], ['users.user_id'], ),
    )
    
    # Create index for geographic queries
    op.create_index('idx_markers_location', 'markers', ['location'], postgresql_using='gist')
    
    # Create indexes for common queries
    op.create_index('idx_markers_status', 'markers', ['status'])
    op.create_index('idx_markers_donator', 'markers', ['donator_user_id'])
    op.create_index('idx_markers_receiver', 'markers', ['receiver_user_id'])
    op.create_index('idx_markers_creation_date', 'markers', ['creation_date'])

def downgrade():
    # Drop markers table
    op.drop_table('markers')
