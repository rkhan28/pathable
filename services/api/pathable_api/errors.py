"""Structured errors with the contract's codes. Human text is rendered by the client."""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

STATUS = {
    "outside_coverage": 422,
    "no_route": 404,
    "invalid_request": 400,
    "rate_limited": 429,
    "unavailable": 503,
    "not_found": 404,
    "internal": 500,
}
RETRYABLE = {"rate_limited", "unavailable", "internal"}


class ApiError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def body(code: str, request_id: str | None) -> dict:
    err = {"code": code, "retryable": code in RETRYABLE}
    if request_id:
        err["requestId"] = request_id
    return {"error": err}


def install(app) -> None:
    @app.exception_handler(ApiError)
    async def _api(request: Request, exc: ApiError):
        return JSONResponse(body(exc.code, getattr(request.state, "request_id", None)), status_code=STATUS[exc.code])

    @app.exception_handler(RequestValidationError)
    async def _invalid(request: Request, _exc: RequestValidationError):
        return JSONResponse(body("invalid_request", getattr(request.state, "request_id", None)), status_code=400)

    @app.exception_handler(Exception)
    async def _internal(request: Request, _exc: Exception):
        return JSONResponse(body("internal", getattr(request.state, "request_id", None)), status_code=500)
