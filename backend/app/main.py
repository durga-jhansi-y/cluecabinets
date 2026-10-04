from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import cases, evidence, health, processing, search
from app.database import Base, engine

# Create the database tables if they don't exist yet.
Base.metadata.create_all(bind=engine)

# Create the application. This is the front door of the backend.
app = FastAPI(title="Clue Classifier API")

# Let the frontend call this backend from a different address.
# Browsers block that by default; this switches the block off.
# "*" means any address, which is fine for a hackathon demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Plug the routers in.
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(cases.router, prefix="/api", tags=["cases"])
app.include_router(evidence.router, prefix="/api", tags=["evidence"])
app.include_router(processing.router, prefix="/api", tags=["cross-reference"])
app.include_router(search.router, prefix="/api", tags=["web-research"])
