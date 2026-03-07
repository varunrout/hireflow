"""Analytics and health check endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Application, User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return application funnel summary for the current user."""
    result = await db.execute(
        select(Application.status, func.count(Application.id))
        .where(Application.user_id == current_user.id)
        .group_by(Application.status)
    )
    rows = result.all()
    status_counts = {row[0].value if hasattr(row[0], "value") else str(row[0]): row[1] for row in rows}

    total = sum(status_counts.values())
    return {
        "total_applications": total,
        "by_status": status_counts,
        "conversion_rate": {
            "applied_to_screening": _safe_rate(
                status_counts.get("screening", 0), status_counts.get("applied", 0)
            ),
            "screening_to_offer": _safe_rate(
                status_counts.get("offer", 0), status_counts.get("screening", 0)
            ),
            "offer_to_accepted": _safe_rate(
                status_counts.get("accepted", 0), status_counts.get("offer", 0)
            ),
        },
    }


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator * 100, 1)
