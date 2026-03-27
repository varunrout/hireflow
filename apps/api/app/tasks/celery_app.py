"""Celery application configuration."""
from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery = Celery(
    "hireflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
