import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_brainhub.db"

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import engine
from app.main import app


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def pytest_sessionfinish(session, exitstatus):
    del session, exitstatus
    engine.dispose()
    Path("test_brainhub.db").unlink(missing_ok=True)
