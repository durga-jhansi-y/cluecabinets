from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# The database is one file: backend/data/clue_classifier.db
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{(BASE_DIR / 'data' / 'clue_classifier.db').as_posix()}"

# The engine is the connection to the database file.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# A session is one conversation with the database.
SessionLocal = sessionmaker(bind=engine, autoflush=False)


# Every model (table) inherits from this.
class Base(DeclarativeBase):
    pass


# Gives each request its own session, and closes it afterwards.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
