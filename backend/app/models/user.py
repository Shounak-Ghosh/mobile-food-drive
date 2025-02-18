from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import ARRAY
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column("passwordhash",String, nullable=False)
    account_creation_date = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    dietary_preferences = Column(ARRAY(String))
