from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.learning import router as learning_router
from app.api.routes import router
from app.core.config import get_settings
from app.db.base import Base, FermiQuestion, Game
from app.db.session import SessionLocal, engine
from app.games.fermi_bank import FERMI_QUESTIONS
from app.games.registry import GAMES


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for definition in GAMES:
            if db.scalar(select(Game).where(Game.slug == definition.slug)) is None:
                db.add(
                    Game(
                        slug=definition.slug,
                        name=definition.name,
                        category=definition.category,
                        is_timed=definition.timed,
                    )
                )
        if db.scalar(select(FermiQuestion).limit(1)) is None:
            for prompt, reference, lower, upper, reasoning, category in FERMI_QUESTIONS:
                db.add(
                    FermiQuestion(
                        prompt=prompt,
                        reference=reference,
                        lower_bound=lower,
                        upper_bound=upper,
                        reasoning=reasoning,
                        category=category,
                    )
                )
        db.commit()
    yield


app = FastAPI(title="BrainHub API", version="0.1.0", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, error: RequestValidationError) -> JSONResponse:
    # Do not echo raw answers or non-JSON float values in validation responses.
    # Nonfinite input must produce a normal 422, rather than crashing JSONResponse.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": list(item.get("loc", ())),
                    "msg": str(item.get("msg", "Invalid request")),
                    "type": str(item.get("type", "validation_error")),
                }
                for item in error.errors()
            ]
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(learning_router)
