"""V1 API router aggregating all endpoint groups."""
from fastapi import APIRouter

from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.automation import router as automation_router
from app.api.v1.endpoints.applications import router as applications_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.jobs import router as jobs_router
from app.api.v1.endpoints.profiles import router as profiles_router
from app.api.v1.endpoints.resumes import router as resumes_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(profiles_router)
api_router.include_router(jobs_router)
api_router.include_router(applications_router)
api_router.include_router(resumes_router)
api_router.include_router(analytics_router)
api_router.include_router(automation_router)
