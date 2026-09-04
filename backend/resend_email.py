"""Server-only Resend transport and normalized received-email models."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping, Sequence
from email.utils import parseaddr
from typing import Any, Literal
from urllib.parse import quote

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError


RESEND_API_URL = "https://api.resend.com"
RESEND_TIMEOUT = httpx.Timeout(connect=3.0, read=10.0, write=10.0, pool=3.0)

MAX_ADDRESS_LENGTH = 320
MAX_RECIPIENTS = 50
MAX_SUBJECT_LENGTH = 300
MAX_TEXT_LENGTH = 100_000
MAX_HTML_LENGTH = 200_000
MAX_MESSAGE_ID_LENGTH = 998
MAX_REFERENCES = 20
MAX_ATTACHMENT_COUNT = 50
MAX_ATTACHMENT_ID_LENGTH = 200
MAX_ATTACHMENT_FILENAME_LENGTH = 240
MAX_CONTENT_TYPE_LENGTH = 255
MAX_ATTACHMENT_SIZE = 2**63 - 1

ResendErrorCode = Literal[
    "not_configured",
    "provider_rejected",
    "provider_unavailable",
    "delivery_failed",
]


class ResendError(RuntimeError):
    """A provider-boundary error containing only an allowlisted safe code."""

    def __init__(self, code: ResendErrorCode):
        self.code = code
        super().__init__(code)


class ResendConfig(BaseModel):
    """Server-only Resend configuration loaded with fail-closed semantics."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    enabled: bool
    api_key: str
    webhook_secret: str
    from_email: str
    notification_to: str
    inbound_domain: str
    inbound_address: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "ResendConfig":
        source = os.environ if env is None else env
        enabled_value = source.get("RESEND_ENABLED", "false")
        if enabled_value not in {"true", "false"}:
            raise ResendError("not_configured")

        if enabled_value == "false":
            return cls(
                enabled=False,
                api_key="",
                webhook_secret="",
                from_email="",
                notification_to="",
                inbound_domain="",
                inbound_address="",
            )

        environment_fields = {
            "api_key": "RESEND_API_KEY",
            "webhook_secret": "RESEND_WEBHOOK_SECRET",
            "from_email": "RESEND_FROM_EMAIL",
            "notification_to": "RESEND_NOTIFICATION_TO",
            "inbound_domain": "RESEND_INBOUND_DOMAIN",
            "inbound_address": "RESEND_INBOUND_ADDRESS",
        }
        values: dict[str, str] = {}
        for field, variable in environment_fields.items():
            raw_value = source.get(variable)
            if not isinstance(raw_value, str) or not raw_value.strip():
                raise ResendError("not_configured")
            values[field] = raw_value.strip()

        try:
            return cls(enabled=True, **values)
        except ValidationError:
            raise ResendError("not_configured") from None


class ReceivedAttachment(BaseModel):
    """Safe attachment metadata; provider download locations are omitted."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    id: str = Field(max_length=MAX_ATTACHMENT_ID_LENGTH)
    filename: str = Field(max_length=MAX_ATTACHMENT_FILENAME_LENGTH)
    content_type: str = Field(max_length=MAX_CONTENT_TYPE_LENGTH)
    size: int = Field(ge=0, le=MAX_ATTACHMENT_SIZE)


class ReceivedEmail(BaseModel):
    """Normalized and explicitly bounded content returned by Resend."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    id: str = Field(default="", max_length=MAX_ATTACHMENT_ID_LENGTH)
    sender: str = Field(max_length=MAX_ADDRESS_LENGTH)
    recipients: list[str] = Field(max_length=MAX_RECIPIENTS)
    subject: str = Field(max_length=MAX_SUBJECT_LENGTH)
    text: str = Field(max_length=MAX_TEXT_LENGTH)
    html: str = Field(max_length=MAX_HTML_LENGTH)
    message_id: str = Field(max_length=MAX_MESSAGE_ID_LENGTH)
    references: list[str] = Field(max_length=MAX_REFERENCES)
    attachments: list[ReceivedAttachment] = Field(max_length=MAX_ATTACHMENT_COUNT)


def _bounded_string(value: Any, limit: int) -> str:
    return value[:limit] if isinstance(value, str) else ""


def _normalized_address(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    stripped = value.strip()
    _display_name, parsed = parseaddr(stripped)
    return (parsed or stripped).lower()[:MAX_ADDRESS_LENGTH]


def _header_value(headers: Any, name: str) -> Any:
    if not isinstance(headers, Mapping):
        return None
    wanted = name.lower()
    for key, value in headers.items():
        if isinstance(key, str) and key.lower() == wanted:
            return value
    return None


def _normalized_references(value: Any) -> list[str]:
    if isinstance(value, str):
        bracketed = re.findall(r"<[^<>]*>", value)
        values: Sequence[Any] = bracketed or value.split()
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        values = value
    else:
        values = ()
    return [
        item.strip()[:MAX_MESSAGE_ID_LENGTH]
        for item in values
        if isinstance(item, str) and item.strip()
    ][:MAX_REFERENCES]


def _attachment_size(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return 0
    return min(max(parsed, 0), MAX_ATTACHMENT_SIZE)


def _normalized_attachments(value: Any) -> list[ReceivedAttachment]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        return []

    attachments = []
    for item in value[:MAX_ATTACHMENT_COUNT]:
        if not isinstance(item, Mapping):
            continue
        attachments.append(
            ReceivedAttachment(
                id=_bounded_string(item.get("id"), MAX_ATTACHMENT_ID_LENGTH),
                filename=_bounded_string(
                    item.get("filename"), MAX_ATTACHMENT_FILENAME_LENGTH
                ),
                content_type=_bounded_string(
                    item.get("content_type"), MAX_CONTENT_TYPE_LENGTH
                ),
                size=_attachment_size(item.get("size")),
            )
        )
    return attachments


class ResendClient:
    """Small HTTPX boundary for outbound and received Resend email calls."""

    def __init__(
        self,
        config: ResendConfig,
        *,
        http_client: httpx.AsyncClient,
    ):
        self.config = config
        self.http_client = http_client

    def _require_configured(self) -> None:
        required = (
            self.config.api_key,
            self.config.webhook_secret,
            self.config.from_email,
            self.config.notification_to,
            self.config.inbound_domain,
            self.config.inbound_address,
        )
        if not self.config.enabled or not all(value.strip() for value in required):
            raise ResendError("not_configured")

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        self._require_configured()
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            **kwargs.pop("headers", {}),
        }
        try:
            response = await self.http_client.request(
                method,
                f"{RESEND_API_URL}{path}",
                headers=headers,
                timeout=RESEND_TIMEOUT,
                **kwargs,
            )
        except (httpx.RequestError, OSError):
            raise ResendError("provider_unavailable") from None

        if 200 <= response.status_code < 300:
            return response
        if 400 <= response.status_code < 500:
            raise ResendError("provider_rejected")
        if response.status_code >= 500:
            raise ResendError("provider_unavailable")
        raise ResendError("delivery_failed")

    async def send(
        self,
        *,
        to: Sequence[str] | str,
        subject: str,
        text: str,
        html: str,
        idempotency_key: str,
        reply_to: str | None = None,
        in_reply_to: str | None = None,
        references: Sequence[str] | None = None,
    ) -> str:
        recipients = [to] if isinstance(to, str) else list(to)
        payload: dict[str, Any] = {
            "from": self.config.from_email,
            "to": recipients,
            "subject": subject,
            "text": text,
            "html": html,
        }
        if reply_to is not None:
            payload["reply_to"] = reply_to

        thread_headers = {}
        if in_reply_to is not None:
            thread_headers["In-Reply-To"] = in_reply_to
        if references:
            thread_headers["References"] = " ".join(references)
        if thread_headers:
            payload["headers"] = thread_headers

        response = await self._request(
            "POST",
            "/emails",
            headers={"Idempotency-Key": idempotency_key},
            json=payload,
        )
        try:
            response_payload = response.json()
        except (ValueError, TypeError):
            raise ResendError("delivery_failed") from None
        email_id = (
            response_payload.get("id")
            if isinstance(response_payload, Mapping)
            else None
        )
        if not isinstance(email_id, str) or not email_id.strip():
            raise ResendError("delivery_failed")
        return email_id

    async def get_received_email(self, email_id: str) -> ReceivedEmail:
        if not isinstance(email_id, str) or not email_id:
            raise ResendError("delivery_failed")
        response = await self._request(
            "GET", f"/emails/receiving/{quote(email_id, safe='')}"
        )
        try:
            payload = response.json()
        except (ValueError, TypeError):
            raise ResendError("delivery_failed") from None
        if not isinstance(payload, Mapping):
            raise ResendError("delivery_failed")

        raw_recipients = payload.get("to")
        if isinstance(raw_recipients, str):
            recipient_values: Sequence[Any] = (raw_recipients,)
        elif isinstance(raw_recipients, Sequence) and not isinstance(
            raw_recipients, (bytes, bytearray)
        ):
            recipient_values = raw_recipients
        else:
            recipient_values = ()
        recipients = [
            normalized
            for item in recipient_values[:MAX_RECIPIENTS]
            if (normalized := _normalized_address(item))
        ]

        headers = payload.get("headers")
        raw_message_id = payload.get("message_id")
        if not isinstance(raw_message_id, str):
            raw_message_id = _header_value(headers, "message-id")
        raw_references = _header_value(headers, "references")
        if raw_references is None:
            raw_references = payload.get("references")

        try:
            return ReceivedEmail(
                id=_bounded_string(payload.get("id"), MAX_ATTACHMENT_ID_LENGTH),
                sender=_normalized_address(payload.get("from")),
                recipients=recipients,
                subject=_bounded_string(payload.get("subject"), MAX_SUBJECT_LENGTH),
                text=_bounded_string(payload.get("text"), MAX_TEXT_LENGTH),
                html=_bounded_string(payload.get("html"), MAX_HTML_LENGTH),
                message_id=(
                    raw_message_id.strip()[:MAX_MESSAGE_ID_LENGTH]
                    if isinstance(raw_message_id, str)
                    else ""
                ),
                references=_normalized_references(raw_references),
                attachments=_normalized_attachments(payload.get("attachments")),
            )
        except ValidationError:
            raise ResendError("delivery_failed") from None
