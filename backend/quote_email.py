"""Self-contained email for a quote already saved by the public form."""

import re
from datetime import date
from html import escape
from urllib.parse import quote, urlencode

from email_validator import EmailNotValidError, validate_email

QUOTE_INBOX_PREFIX = "quote-"


def quote_inbox_url(quote_id: str) -> str:
    query = urlencode({"sectiune": "inbox", "mesaj": QUOTE_INBOX_PREFIX + quote_id})
    return f"https://fireart.ro/admin?{query}"


def quote_contact_address(value: str) -> str | None:
    try:
        return validate_email(value, check_deliverability=False, allow_smtputf8=False).ascii_email
    except EmailNotValidError:
        return None


def display_event_date(value: str) -> str:
    try:
        return date.fromisoformat(value).strftime("%d.%m.%Y")
    except ValueError:
        return value


def render_quote_email(fields: dict[str, str], url: str) -> str:
    content = {key: escape(value) for key, value in fields.items()}
    address = quote_contact_address(fields["Email"])
    number = re.sub(r"[ ()-]", "", fields["Telefon"])

    def contact_link(label: str, href: str | None) -> str:
        value = content[label]
        return (
            f'<a href="{escape(href)}" style="color:#224c9d;text-decoration:underline;overflow-wrap:anywhere;">{value}</a>'
            if href else value
        )

    email = contact_link("Email", f"mailto:{quote(address, safe='@.+')}" if address else None)
    phone = contact_link("Telefon", f"tel:{number}" if re.fullmatch(r"\+?[0-9]{7,15}", number) else None)
    occasion = " &middot; ".join(
        content[key] for key in ("Tip eveniment", "Data eveniment", "Localitate") if content[key]
    )
    rows = "".join(
        f'<tr><th scope="row" align="left" valign="top" style="width:35%;border-top:1px solid #dde5f1;'
        f'padding:9px 10px 9px 0;font-size:13px;font-weight:normal;color:#4b5d78;">{label}</th>'
        f'<td valign="top" style="border-top:1px solid #dde5f1;padding:9px 0;font-size:14px;'
        f'line-height:20px;color:#14213a;overflow-wrap:anywhere;">{content[label]}</td></tr>'
        for label in ("Locație eveniment", "Servicii", "Pachet") if content[label]
    )
    message = content["Mesaj"].replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")
    note = (
        '<h2 style="margin:24px 0 9px;font-size:15px;line-height:21px;color:#14213a;">Mesajul clientului</h2>'
        f'<blockquote style="margin:0;padding:12px 14px;border-left:3px solid #6292ec;'
        f'background-color:#f0f5ff;color:#14213a;font-size:15px;line-height:23px;overflow-wrap:anywhere;">'
        f'{message}</blockquote>' if message else ""
    )

    # Tables and inline styles keep the layout usable in mail clients that strip CSS.
    return f"""<!doctype html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cerere de ofertă nouă | FireArtRo</title></head>
<body style="margin:0;padding:0;background-color:#edf2f9;color:#14213a;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#edf2f9">
<tr><td align="center" style="padding:18px 12px;">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;table-layout:fixed;">
<tr><td bgcolor="#101c33" style="border-top:4px solid #81aafa;padding:22px 22px 24px;color:#ffffff;">
<p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:15px;line-height:20px;font-weight:bold;letter-spacing:2px;color:#ffffff;">FIREART<span style="color:#a9c8ff;">RO</span></p>
<h1 style="margin:0;font-size:27px;line-height:33px;letter-spacing:-.5px;color:#ffffff;">Cerere de ofertă nouă</h1>
<p style="margin:8px 0 0;color:#cddcff;font-size:15px;line-height:22px;overflow-wrap:anywhere;">{occasion}</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="padding:21px 22px 24px;">
<h2 style="margin:0 0 5px;font-size:12px;line-height:18px;letter-spacing:1px;color:#415777;">CLIENT</h2>
<p style="margin:0 0 5px;font-weight:bold;font-size:21px;line-height:27px;color:#14213a;overflow-wrap:anywhere;">{content["Nume"]}</p>
<p style="margin:0;font-size:14px;line-height:22px;overflow-wrap:anywhere;">{email}<br>{phone}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 20px;">
<tr><td bgcolor="#224c9d" style="border-radius:5px;">
<a href="{escape(url)}" style="display:inline-block;border:12px solid #224c9d;color:#ffffff;font-size:14px;line-height:19px;font-weight:bold;text-decoration:none;">&nbsp;Deschide în Mesaje&nbsp;</a>
</td></tr></table>
<h2 style="margin:0 0 8px;font-size:15px;line-height:21px;color:#14213a;">Detalii eveniment</h2>
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-collapse:collapse;">{rows}</table>
{note}
</td></tr>
<tr><td style="padding:12px 5px 2px;font-size:12px;line-height:18px;color:#4b5d78;">
Notificare FireArtRo. Poți răspunde clientului din Admin sau folosind „Răspunde” în email.
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>"""
