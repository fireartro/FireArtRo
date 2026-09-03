"""Contract tests for the server-only Resend provider boundary."""

import json

import httpx
import pytest


RESEND_ENVIRONMENT = (
    "RESEND_ENABLED",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "RESEND_FROM_EMAIL",
    "RESEND_NOTIFICATION_TO",
    "RESEND_INBOUND_DOMAIN",
    "RESEND_INBOUND_ADDRESS",
)


def clear_resend_environment(monkeypatch):
    for name in RESEND_ENVIRONMENT:
        monkeypatch.delenv(name, raising=False)


def set_complete_resend_environment(monkeypatch):
    values = {
        "RESEND_ENABLED": "true",
        "RESEND_API_KEY": "re_test_contract_key_not_real",
        "RESEND_WEBHOOK_SECRET": "whsec_test_contract_secret_not_real",
        "RESEND_FROM_EMAIL": "FireArtRo Test <notifications@example.com>",
        "RESEND_NOTIFICATION_TO": "owner@example.com",
        "RESEND_INBOUND_DOMAIN": "inbound.example.com",
        "RESEND_INBOUND_ADDRESS": "contact@inbound.example.com",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    return values


def provider_config(ResendConfig):
    return ResendConfig(
        enabled=True,
        api_key="re_test_contract_key_not_real",
        webhook_secret="whsec_test_contract_secret_not_real",
        from_email="FireArtRo Test <notifications@example.com>",
        notification_to="owner@example.com",
        inbound_domain="inbound.example.com",
        inbound_address="contact@inbound.example.com",
    )


def test_resend_config_disabled_mode_needs_no_provider_values(monkeypatch):
    from resend_email import ResendConfig

    clear_resend_environment(monkeypatch)
    monkeypatch.setenv("RESEND_ENABLED", "false")

    config = ResendConfig.from_env()

    assert config.model_dump() == {
        "enabled": False,
        "api_key": "",
        "webhook_secret": "",
        "from_email": "",
        "notification_to": "",
        "inbound_domain": "",
        "inbound_address": "",
    }


def test_resend_config_enabled_mode_reads_every_required_value(monkeypatch):
    from resend_email import ResendConfig

    clear_resend_environment(monkeypatch)
    values = set_complete_resend_environment(monkeypatch)

    config = ResendConfig.from_env()

    assert config.model_dump() == {
        "enabled": True,
        "api_key": values["RESEND_API_KEY"],
        "webhook_secret": values["RESEND_WEBHOOK_SECRET"],
        "from_email": values["RESEND_FROM_EMAIL"],
        "notification_to": values["RESEND_NOTIFICATION_TO"],
        "inbound_domain": values["RESEND_INBOUND_DOMAIN"],
        "inbound_address": values["RESEND_INBOUND_ADDRESS"],
    }


def test_resend_config_enabled_but_incomplete_raises_only_a_safe_code(monkeypatch):
    from resend_email import ResendConfig, ResendError

    clear_resend_environment(monkeypatch)
    values = set_complete_resend_environment(monkeypatch)
    monkeypatch.delenv("RESEND_INBOUND_ADDRESS")

    with pytest.raises(ResendError) as captured:
        ResendConfig.from_env()

    rendered = f"{captured.value!s} {captured.value!r}"
    assert captured.value.code == "not_configured"
    assert "not_configured" in rendered
    assert values["RESEND_API_KEY"] not in rendered
    assert values["RESEND_WEBHOOK_SECRET"] not in rendered


@pytest.mark.asyncio
async def test_send_posts_the_exact_resend_request_and_returns_only_the_email_id():
    from resend_email import ResendClient, ResendConfig

    def handle(request):
        assert request.method == "POST"
        assert str(request.url) == "https://api.resend.com/emails"
        assert (
            request.headers["Authorization"] == "Bearer re_test_contract_key_not_real"
        )
        assert request.headers["Idempotency-Key"] == "quote-notification/quote-test-001"
        assert json.loads(request.content) == {
            "from": "FireArtRo Test <notifications@example.com>",
            "to": ["owner@example.com"],
            "subject": "Cerere nouă",
            "text": "Mesaj text de test.",
            "html": "<p>Mesaj HTML de test.</p>",
            "reply_to": "customer@example.com",
        }
        assert "re_test_contract_key_not_real" not in request.content.decode()
        return httpx.Response(200, json={"id": "provider-email-001"})

    transport = httpx.MockTransport(handle)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = ResendClient(provider_config(ResendConfig), http_client=http_client)
        result = await client.send(
            to=["owner@example.com"],
            subject="Cerere nouă",
            text="Mesaj text de test.",
            html="<p>Mesaj HTML de test.</p>",
            idempotency_key="quote-notification/quote-test-001",
            reply_to="customer@example.com",
        )

    assert result == "provider-email-001"


@pytest.mark.asyncio
async def test_send_converts_provider_rejection_to_an_exception_without_secrets():
    from resend_email import ResendClient, ResendConfig, ResendError

    api_key = "re_test_contract_key_not_real"

    def reject(request):
        assert request.headers["Authorization"] == f"Bearer {api_key}"
        return httpx.Response(
            401,
            json={"message": f"provider rejected secret {api_key}"},
        )

    transport = httpx.MockTransport(reject)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = ResendClient(provider_config(ResendConfig), http_client=http_client)
        with pytest.raises(ResendError) as captured:
            await client.send(
                to=["owner@example.com"],
                subject="Cerere nouă",
                text="Mesaj text de test.",
                html="<p>Mesaj HTML de test.</p>",
                idempotency_key="quote-notification/quote-test-002",
                reply_to="customer@example.com",
            )

    rendered = f"{captured.value!s} {captured.value!r}"
    assert captured.value.code == "provider_rejected"
    assert "provider_rejected" in rendered
    assert api_key not in rendered


@pytest.mark.asyncio
async def test_get_received_email_normalizes_and_caps_provider_content():
    from resend_email import ResendClient, ResendConfig

    recipients = [
        f" RECIPIENT-{number:03d}-" + "R" * 330 + "@example.com "
        for number in range(52)
    ]
    references = [
        f"<REFERENCE-{number:02d}-" + "R" * 1_100 + "@example.com>"
        for number in range(22)
    ]
    attachments = [
        {
            "id": f"attachment-{number:02d}-" + "I" * 210,
            "filename": "x" * 245 + f"-{number:02d}.txt",
            "content_type": "application/x-contract-" + "C" * 300,
            "size": number + 1,
            "download_url": f"https://files.example.com/private-{number:02d}",
        }
        for number in range(52)
    ]

    def handle(request):
        assert request.method == "GET"
        assert (
            str(request.url)
            == "https://api.resend.com/emails/receiving/received-email-001"
        )
        assert (
            request.headers["Authorization"] == "Bearer re_test_contract_key_not_real"
        )
        return httpx.Response(
            200,
            json={
                "id": "received-email-001",
                "from": "  " + "S" * 325 + "  ",
                "to": recipients,
                "subject": "S" * 305,
                "text": "T" * 100_005,
                "html": "H" * 200_005,
                "message_id": "  <" + "M" * 1_100 + ">  ",
                "headers": {"references": " ".join(references)},
                "attachments": attachments,
            },
        )

    transport = httpx.MockTransport(handle)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = ResendClient(provider_config(ResendConfig), http_client=http_client)
        received = await client.get_received_email("received-email-001")

    assert received.sender == "s" * 320
    assert len(received.sender) == 320
    assert len(received.recipients) == 50
    assert all(len(recipient) == 320 for recipient in received.recipients)
    assert received.recipients[0] == "recipient-000-" + "r" * 306
    assert received.recipients[-1] == "recipient-049-" + "r" * 306
    assert received.subject == "S" * 300
    assert received.text == "T" * 100_000
    assert received.html == "H" * 200_000
    assert received.message_id == "<" + "M" * 997
    assert len(received.message_id) == 998
    assert len(received.references) == 20
    assert all(len(reference) == 998 for reference in received.references)
    assert received.references[0] == "<REFERENCE-00-" + "R" * 984
    assert received.references[-1] == "<REFERENCE-19-" + "R" * 984
    assert len(received.attachments) == 50
    assert all(len(attachment.id) == 200 for attachment in received.attachments)
    assert all(len(attachment.filename) == 240 for attachment in received.attachments)
    assert all(
        len(attachment.content_type) == 255 for attachment in received.attachments
    )
    assert received.attachments[0].model_dump() == {
        "id": "attachment-00-" + "I" * 186,
        "filename": "x" * 240,
        "content_type": "application/x-contract-" + "C" * 232,
        "size": 1,
    }
    assert received.attachments[-1].id == "attachment-49-" + "I" * 186
    assert "download_url" not in received.attachments[0].model_dump()
