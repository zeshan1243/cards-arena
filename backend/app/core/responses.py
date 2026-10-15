import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import Envelope

logger = logging.getLogger("cardarena")


def ok[T](data: T, message: str | None = None) -> Envelope[T]:
    return Envelope[T](success=True, data=data, message=message)


def _error(status: int, message: str, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"success": False, "data": None, "message": message}, headers=headers
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Every error uses the standard envelope (spec §72)."""

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(exc.status_code, str(exc.detail), getattr(exc, "headers", None))

    @app.exception_handler(HTTPException)
    async def fastapi_http_error(_: Request, exc: HTTPException) -> JSONResponse:
        return _error(exc.status_code, str(exc.detail), exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", [])[1:])
        msg = first.get("msg", "Invalid request")
        return _error(422, f"{field}: {msg}" if field else msg)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return _error(500, "Internal server error")
