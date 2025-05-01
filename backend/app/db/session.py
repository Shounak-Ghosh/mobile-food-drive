from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg2://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}/{settings.DB_NAME}"
)

# Configure connection pooling with proper settings
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # Maximum number of connections to keep in the pool
    pool_size=10,
    # Maximum number of connections to create when pool_size is reached
    max_overflow=15,
    # Connection recycle time (in seconds) - recreate connections after this time
    pool_recycle=300,
    # Connection timeout (in seconds)
    pool_timeout=30,
    # Log connection errors
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        # Ensure connection is properly closed
        db.close()
