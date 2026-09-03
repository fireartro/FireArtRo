import importlib


def test_vercel_entrypoint_exports_fireartro_fastapi_app(monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "fireartro_test")
    module = importlib.import_module("api.index")
    assert module.app.title == "FireArtRo API"
    assert any(route.path == "/api/" for route in module.app.routes)
