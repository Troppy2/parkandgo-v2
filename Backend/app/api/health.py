from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    return {"status": "ok"}


@router.get("/startup-checks")
async def startup_health_checks():
    return {"status": "ok"}


@router.get("/startup")
async def startup_health():
    return {"status": "ok"}
