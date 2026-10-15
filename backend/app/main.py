import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, games, sessions, statistics, users
from app.core.config import get_settings
from app.core.responses import register_exception_handlers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

settings = get_settings()

app = FastAPI(title="CardArena API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
register_exception_handlers(app)

for module in (auth, users, games, sessions, statistics):
    app.include_router(module.router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
