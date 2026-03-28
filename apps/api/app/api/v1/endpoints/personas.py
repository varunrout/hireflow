"""Persona endpoints — manage applying-as personas and their resumes."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Persona, ResumeVersion, User
from app.schemas.schemas import PersonaCreate, PersonaResponse, PersonaUpdate

router = APIRouter(prefix="/personas", tags=["personas"])


async def _get_persona_or_404(
    persona_id: UUID, user_id: UUID, db: AsyncSession
) -> Persona:
    result = await db.execute(
        select(Persona).where(Persona.id == persona_id, Persona.user_id == user_id)
    )
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    return persona


async def _count_resumes(persona_id: UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).where(ResumeVersion.persona_id == persona_id)
    )
    return result.scalar_one()


@router.get("", response_model=list[PersonaResponse])
async def list_personas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(Persona)
        .where(Persona.user_id == current_user.id)
        .order_by(Persona.is_default.desc(), Persona.created_at)
    )
    personas = result.scalars().all()
    out = []
    for p in personas:
        count = await _count_resumes(p.id, db)
        d = PersonaResponse.model_validate(p).model_dump()
        d["resume_count"] = count
        out.append(d)
    return out


@router.post("", response_model=PersonaResponse, status_code=status.HTTP_201_CREATED)
async def create_persona(
    payload: PersonaCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # If this is being set as default, clear any existing default
    if payload.is_default:
        await db.execute(
            select(Persona)
            .where(Persona.user_id == current_user.id, Persona.is_default == True)  # noqa: E712
        )
        existing = (
            await db.execute(
                select(Persona).where(
                    Persona.user_id == current_user.id, Persona.is_default == True  # noqa: E712
                )
            )
        ).scalars().all()
        for p in existing:
            p.is_default = False

    persona = Persona(user_id=current_user.id, **payload.model_dump())
    db.add(persona)
    await db.flush()
    await db.refresh(persona)
    d = PersonaResponse.model_validate(persona).model_dump()
    d["resume_count"] = 0
    return d


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    persona = await _get_persona_or_404(persona_id, current_user.id, db)
    count = await _count_resumes(persona.id, db)
    d = PersonaResponse.model_validate(persona).model_dump()
    d["resume_count"] = count
    return d


@router.put("/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: UUID,
    payload: PersonaUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    persona = await _get_persona_or_404(persona_id, current_user.id, db)

    # If setting as default, clear others
    if payload.is_default:
        others = (
            await db.execute(
                select(Persona).where(
                    Persona.user_id == current_user.id,
                    Persona.is_default == True,  # noqa: E712
                    Persona.id != persona_id,
                )
            )
        ).scalars().all()
        for p in others:
            p.is_default = False

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(persona, field, value)

    await db.flush()
    await db.refresh(persona)
    count = await _count_resumes(persona.id, db)
    d = PersonaResponse.model_validate(persona).model_dump()
    d["resume_count"] = count
    return d


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    persona = await _get_persona_or_404(persona_id, current_user.id, db)
    # Detach resumes from deleted persona (set persona_id to NULL)
    resumes = (
        await db.execute(
            select(ResumeVersion).where(ResumeVersion.persona_id == persona.id)
        )
    ).scalars().all()
    for r in resumes:
        r.persona_id = None
    await db.delete(persona)
    await db.flush()


@router.get("/{persona_id}/resumes", response_model=list[dict])
async def list_persona_resumes(
    persona_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    await _get_persona_or_404(persona_id, current_user.id, db)
    result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.persona_id == persona_id,
            ResumeVersion.user_id == current_user.id,
        ).order_by(ResumeVersion.updated_at.desc())
    )
    resumes = result.scalars().all()
    from app.schemas.schemas import ResumeVersionResponse
    return [ResumeVersionResponse.model_validate(r).model_dump(mode="json") for r in resumes]
