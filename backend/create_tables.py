from database import Base, engine
from models.project_db import ProjectDB

print("Creating database tables...")

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")