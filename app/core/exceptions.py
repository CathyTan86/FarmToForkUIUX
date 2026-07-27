from fastapi import Request
from fastapi.responses import JSONResponse

class BusinessLogicException(Exception):
    def __init__(self, detail: str):
        self.detail = detail

async def business_logic_exception_handler(request: Request, exc: BusinessLogicException):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.detail},
    )
