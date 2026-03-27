"""Applications API endpoints: create, update status, list."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Application, ApplicationAnswer, User
from app.schemas.schemas import (
    ApplicationAnswerCreate,
    ApplicationAnswerResponse,
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStatusUpdate,
    PaginatedResponse,
)

router = APIRouter(prefix="/applications", tags=["applications"])

VALID_TRANSITIONS: dict[str, list[str]] = {
    "saved": ["applied", "withdrawn"],
    "applied": ["screening", "rejected", "withdrawn"],
    "screening": ["phone_interview", "rejected", "withdrawn"],
    "phone_interview": ["technical_interview", "rejected", "withdrawn"],
    "technical_interview": ["onsite_interview", "rejected", "withdrawn"],
    "onsite_interview": ["offer", "rejected", "withdrawn"],
    "offer": ["accepted", "rejected", "withdrawn"],
    "rejected": [],
    "withdrawn": [],
    "accepted": [],
}


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Application:
    app = Application(user_id=current_user.id, **payload.model_dump())
    db.add(app)
    await db.flush()
    await db.refresh(app)
    return app


@router.get("", response_model=PaginatedResponse)
async def list_applications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    query = select(Application).where(Application.user_id == current_user.id)
    if status_filter:
        query = query.where(Application.status == status_filter)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    offset = (page - 1) * limit
    result = await db.execute(
        query.offset(offset).limit(limit).order_by(Application.updated_at.desc())
    )
    items = result.scalars().all()
    serialized_items = [
        ApplicationResponse.model_validate(item).model_dump(mode="json") for item in items
    ]

    return {
        "items": serialized_items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Application:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    return app


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: UUID,
    payload: ApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Application:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )

    current_status = app.status.value if hasattr(app.status, "value") else str(app.status)
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{current_status}' to '{payload.status}'",
        )

    app.status = payload.status
    if payload.notes is not None:
        app.notes = payload.notes
    if payload.status == "applied":
        from datetime import datetime, timezone

        app.applied_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(app)
    return app


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    await db.delete(app)


# ---------------------------------------------------------------------------
# Application Answers
# ---------------------------------------------------------------------------


@router.post(
    "/{application_id}/answers",
    response_model=ApplicationAnswerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_answer(
    application_id: UUID,
    payload: ApplicationAnswerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicationAnswer:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    answer = ApplicationAnswer(application_id=application_id, **payload.model_dump())
    db.add(answer)
    await db.flush()
    await db.refresh(answer)
    return answer


@router.get(
    "/{application_id}/answers",
    response_model=list[ApplicationAnswerResponse],
)
async def list_answers(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApplicationAnswer]:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    ans_result = await db.execute(
        select(ApplicationAnswer).where(ApplicationAnswer.application_id == application_id)
    )
    return list(ans_result.scalars().all())
