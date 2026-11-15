"""Read saved quotes alongside incoming email without duplicating records."""

import re

from email_inbox import (
    INBOUND_SUMMARY_FIELDS,
    MAX_PAGE,
    MAX_PAGE_SIZE,
    MAX_SEARCH_LENGTH,
    QUERY_TIMEOUT_MS,
    InboundPage,
    InboxCategory,
    QuoteReplyTarget,
)
from quote_admin import QuoteDetail
from quote_email import QUOTE_INBOX_PREFIX

QUOTE_INBOX_FIELDS = {
    "_id": 0,
    **dict.fromkeys((
        "id", "first_name", "last_name", "email", "phone", "locality",
        "event_type", "event_location", "event_date", "created_at",
        "services", "package_title", "message",
    ), 1),
}
QUOTE_FILTER = {"status": {"$ne": "spam"}}
SUBJECT_PREFIX = "Cerere de ofertă — "


class MongoQuoteInbox:
    def __init__(self, quotes, inbound):
        self.quotes = quotes
        self.inbound = inbound

    async def list(self, *, q="", category: InboxCategory | None = None, page=1, page_size=20):
        if self.quotes is None or self.inbound is None:
            raise RuntimeError("inbox unavailable")
        if not 1 <= page <= MAX_PAGE or not 1 <= page_size <= MAX_PAGE_SIZE:
            raise ValueError("invalid pagination")
        quote_pipeline = [
            {"$match": QUOTE_FILTER},
            {"$project": {
                "_id": 0,
                "id": {"$concat": [QUOTE_INBOX_PREFIX, "$id"]},
                "from": "$email",
                "subject": {"$concat": [SUBJECT_PREFIX, {"$trim": {"input": {"$concat": [
                    {"$ifNull": ["$first_name", ""]}, " ", {"$ifNull": ["$last_name", ""]},
                ]}}}]},
                "category": {"$literal": "quote"},
                "received_at": "$created_at",
                "relay_state": {"$literal": None},
            }},
        ]
        if category == "quote":
            collection, pipeline = self.quotes, quote_pipeline
        else:
            collection = self.inbound
            pipeline = [
                {"$match": {"ingest_state": {"$ne": "reserved"}}},
                {"$project": INBOUND_SUMMARY_FIELDS},
                {"$unionWith": {"coll": self.quotes.name, "pipeline": quote_pipeline}},
            ]
        search = q.strip()[:MAX_SEARCH_LENGTH]
        if search:
            literal = {"$regex": re.escape(search), "$options": "i"}
            pipeline.append({"$match": {"$or": [{"from": literal}, {"subject": literal}]}})
        pipeline.append({"$facet": {
            "items": [{"$sort": {"received_at": -1, "id": -1}},
                      {"$skip": (page - 1) * page_size}, {"$limit": page_size}],
            "count": [{"$count": "total"}],
        }})
        [result] = await collection.aggregate(pipeline, maxTimeMS=QUERY_TIMEOUT_MS).to_list(1)
        count = result["count"]
        return InboundPage.model_validate({
            "items": result["items"],
            "total": count[0]["total"] if count else 0,
            "page": page,
            "page_size": page_size,
        })

    async def _find(self, message_id: str) -> QuoteDetail | None:
        if self.quotes is None:
            raise RuntimeError("inbox unavailable")
        quote_id = message_id.removeprefix(QUOTE_INBOX_PREFIX)
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,99}", quote_id):
            return None
        document = await self.quotes.find_one(
            {"id": quote_id, **QUOTE_FILTER}, QUOTE_INBOX_FIELDS, max_time_ms=QUERY_TIMEOUT_MS,
        )
        return QuoteDetail.model_validate(document) if document is not None else None

    async def detail(self, message_id: str) -> dict | None:
        quote = await self._find(message_id)
        if quote is None:
            return None
        name = f"{quote.first_name} {quote.last_name}".strip()
        return {
            "id": message_id,
            "from": quote.email,
            "subject": SUBJECT_PREFIX + name,
            "category": "quote",
            "received_at": quote.created_at.isoformat(),
            "text": quote.message,
            "quote": {
                "id": quote.id,
                "name": name,
                "phone": quote.phone,
                "locality": quote.locality,
                "event_type": quote.event_type,
                "event_location": quote.event_location,
                "event_date": quote.event_date,
                "services": quote.services,
                "package_title": quote.package_title,
            },
        }

    async def reply_target(self, message_id: str) -> QuoteReplyTarget | None:
        quote = await self._find(message_id)
        if quote is None:
            return None
        return QuoteReplyTarget(message_id, quote.id, quote.email)
