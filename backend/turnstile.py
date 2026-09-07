"""Server-only Cloudflare Turnstile verification with safe public failures."""

from __future__ import annotations

import ipaddress
from collections.abc import Mapping
from typing import Literal

import httpx


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_TIMEOUT = httpx.Timeout(connect=3.0, read=7.0, write=7.0, pool=3.0)
VERIFICATION_MESSAGE = (
    "Verificarea anti-abuz nu a reușit. Reîncarcă formularul și încearcă din nou."
)
UNAVAILABLE_MESSAGE = "Protecția formularului nu este disponibilă momentan."

TurnstileErrorCode = Literal["not_configured", "verification_failed", "provider_unavailable"]


class TurnstileError(RuntimeError):
    def __init__(self, code: TurnstileErrorCode, status_code: int, public_message: str):
        self.code = code
        self.status_code = status_code
        self.public_message = public_message
        super().__init__(public_message)


class TurnstileVerifier:
    def __init__(self, *, enabled, secret, configuration_error="", transport=None):
        self.enabled = enabled
        self._secret = secret
        self._configuration_error = configuration_error
        self._transport = transport

    @classmethod
    def from_env(cls, env: Mapping[str, str], *, transport=None):
        enabled_value = env.get("TURNSTILE_ENABLED")
        if enabled_value == "false":
            return cls(enabled=False, secret="", transport=transport)
        if enabled_value != "true":
            return cls(
                enabled=True,
                secret="",
                configuration_error="TURNSTILE_ENABLED",
                transport=transport,
            )
        secret = env.get("TURNSTILE_SECRET_KEY", "")
        if not isinstance(secret, str) or not secret.strip():
            return cls(
                enabled=True,
                secret="",
                configuration_error="TURNSTILE_SECRET_KEY",
                transport=transport,
            )
        return cls(enabled=True, secret=secret.strip(), transport=transport)

    @property
    def configuration_errors(self):
        if not self._configuration_error:
            return []
        return [self._configuration_error]

    async def verify(self, token: str, remote_ip: str) -> None:
        if not self.enabled:
            return
        if self._configuration_error or not self._secret:
            raise TurnstileError("not_configured", 503, UNAVAILABLE_MESSAGE)

        normalized_token = token.strip() if isinstance(token, str) else ""
        if not normalized_token:
            raise TurnstileError("verification_failed", 422, VERIFICATION_MESSAGE)

        payload = {"secret": self._secret, "response": normalized_token}
        try:
            payload["remoteip"] = str(ipaddress.ip_address(remote_ip))
        except (TypeError, ValueError):
            pass

        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=TURNSTILE_TIMEOUT,
            ) as client:
                response = await client.post(TURNSTILE_VERIFY_URL, data=payload)
            if response.status_code >= 500:
                raise TurnstileError(
                    "provider_unavailable", 503, UNAVAILABLE_MESSAGE
                )
            if response.status_code >= 400:
                raise TurnstileError(
                    "verification_failed", 422, VERIFICATION_MESSAGE
                )
            result = response.json()
        except TurnstileError:
            raise
        except (httpx.RequestError, OSError, ValueError, TypeError):
            raise TurnstileError(
                "provider_unavailable", 503, UNAVAILABLE_MESSAGE
            ) from None

        if not isinstance(result, dict) or result.get("success") is not True:
            raise TurnstileError("verification_failed", 422, VERIFICATION_MESSAGE)
