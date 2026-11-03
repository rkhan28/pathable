"""Alembic runs plain SQL migrations; SQLAlchemy is only the connection carrier."""

import os

from alembic import context
from sqlalchemy import create_engine

url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1)
with create_engine(url).connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
