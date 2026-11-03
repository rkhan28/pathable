"""Scope edge ids to their data version.

Edge ids (OSM way + piece number) repeat between graph builds, so the key has
to include the version. Without this, loading a new build alongside the
current one fails, which defeats switching versions atomically.

Revision ID: 0002
Revises: 0001
"""

from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE hazards ADD COLUMN data_version text REFERENCES data_versions(id) ON DELETE CASCADE;
        UPDATE hazards h SET data_version = e.data_version FROM edges e WHERE e.id = h.edge_id;
        ALTER TABLE hazards DROP CONSTRAINT hazards_edge_id_fkey;
        ALTER TABLE hazards DROP CONSTRAINT hazards_pkey;
        ALTER TABLE hazards ADD PRIMARY KEY (data_version, id);
        ALTER TABLE edges DROP CONSTRAINT edges_pkey;
        ALTER TABLE edges ADD PRIMARY KEY (data_version, id);
        ALTER TABLE hazards ADD CONSTRAINT hazards_edge_fkey
            FOREIGN KEY (data_version, edge_id) REFERENCES edges (data_version, id) ON DELETE CASCADE;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE hazards DROP CONSTRAINT hazards_edge_fkey;
        ALTER TABLE hazards DROP CONSTRAINT hazards_pkey;
        ALTER TABLE edges DROP CONSTRAINT edges_pkey;
        ALTER TABLE edges ADD PRIMARY KEY (id);
        ALTER TABLE hazards ADD PRIMARY KEY (id);
        ALTER TABLE hazards ADD CONSTRAINT hazards_edge_id_fkey
            FOREIGN KEY (edge_id) REFERENCES edges (id) ON DELETE CASCADE;
        ALTER TABLE hazards DROP COLUMN data_version;
        """
    )
