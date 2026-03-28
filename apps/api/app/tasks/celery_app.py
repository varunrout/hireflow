"""Celery application configuration."""
import ssl

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

# Upstash Redis uses rediss:// (TLS) — Celery needs explicit SSL settings
if settings.CELERY_BROKER_URL.startswith("rediss://"):
    celery.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}

if settings.CELERY_RESULT_BACKEND.startswith("rediss://"):
    celery.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
