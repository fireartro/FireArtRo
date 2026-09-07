"""Fail-closed tests for the server-side Cloudflare Turnstile boundary."""

import json

import httpx
import pytest

from turnstile import TurnstileError, TurnstileVerifier


def response(payload, status=200):
    return httpx.Response(status, json=payload)


def transport(handler):
    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_explicitly_disabled_mode_is_a_noop_without_a_secret():
    verifier = TurnstileVerifier.from_env({"TURNSTILE_ENABLED": "false"})

    await verifier.verify("", "198.51.100.7")


@pytest.mark.asyncio
async def test_valid_token_is_verified_server_side_with_normalized_ip():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["form"] = dict(httpx.QueryParams(request.content.decode()))
        return response({"success": True})

    verifier = TurnstileVerifier.from_env(
        {"TURNSTILE_ENABLED": "true", "TURNSTILE_SECRET_KEY": "server-secret"},
        transport=transport(handler),
    )

    await verifier.verify("browser-token", "198.51.100.7")

    assert seen["url"] == "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    assert seen["form"] == {
        "secret": "server-secret",
        "response": "browser-token",
        "remoteip": "198.51.100.7",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"success": False, "error-codes": ["invalid-input-response"]},
        {"success": False, "error-codes": ["timeout-or-duplicate"]},
    ],
)
async def test_rejected_or_reused_tokens_return_one_safe_public_error(payload):
    verifier = TurnstileVerifier.from_env(
        {"TURNSTILE_ENABLED": "true", "TURNSTILE_SECRET_KEY": "server-secret"},
        transport=transport(lambda _request: response(payload)),
    )

    with pytest.raises(TurnstileError) as caught:
        await verifier.verify("submitted-token", "198.51.100.7")

    assert caught.value.code == "verification_failed"
    assert caught.value.status_code == 422
    assert "submitted-token" not in str(caught.value)
    assert "198.51.100.7" not in str(caught.value)
    assert "invalid-input-response" not in str(caught.value)


@pytest.mark.asyncio
async def test_missing_token_is_rejected_without_contacting_the_provider():
    calls = []
    verifier = TurnstileVerifier.from_env(
        {"TURNSTILE_ENABLED": "true", "TURNSTILE_SECRET_KEY": "server-secret"},
        transport=transport(lambda request: calls.append(request)),
    )

    with pytest.raises(TurnstileError) as caught:
        await verifier.verify("  ", "198.51.100.7")

    assert caught.value.code == "verification_failed"
    assert caught.value.status_code == 422
    assert calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "environment",
    [
        {},
        {"TURNSTILE_ENABLED": "sometimes"},
        {"TURNSTILE_ENABLED": "true", "TURNSTILE_SECRET_KEY": ""},
    ],
)
async def test_missing_or_invalid_enabled_configuration_fails_closed(environment):
    verifier = TurnstileVerifier.from_env(environment)

    with pytest.raises(TurnstileError) as caught:
        await verifier.verify("browser-token", "198.51.100.7")

    assert caught.value.code == "not_configured"
    assert caught.value.status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["timeout", "malformed", "server-error"])
async def test_provider_failures_are_safe_and_fail_closed(kind):
    def handler(request):
        if kind == "timeout":
            raise httpx.ReadTimeout("private provider details", request=request)
        if kind == "malformed":
            return httpx.Response(200, content=b"not-json")
        return response({"private": "provider body"}, status=503)

    verifier = TurnstileVerifier.from_env(
        {"TURNSTILE_ENABLED": "true", "TURNSTILE_SECRET_KEY": "server-secret"},
        transport=transport(handler),
    )

    with pytest.raises(TurnstileError) as caught:
        await verifier.verify("submitted-token", "198.51.100.7")

    assert caught.value.code == "provider_unavailable"
    assert caught.value.status_code == 503
    serialized = json.dumps(caught.value.__dict__)
    assert "server-secret" not in serialized
    assert "submitted-token" not in serialized
    assert "provider body" not in serialized
