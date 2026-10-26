"""Helpers for the front-door routes over the generated client.

Every route is in `uk_data_atlas_client.generated.api`, typed from the OpenAPI
description. These helpers cover the common questions: they return the
response envelope and raise `AtlasError` on a refusal, where the generated
functions return a `Problem` for the caller to check.
"""

import json
from http import HTTPStatus
from typing import Any, Self

import httpx

from .generated.api.data_catalogue import list_measures
from .generated.api.start_here import (
    get_measure_value_for_place,
    resolve_places,
    resolve_postcode,
)
from .generated.api.trend import get_source_exact_measure_series
from .generated.client import Client
from .generated.models import Envelope, PostcodeLookupEnvelope
from .generated.types import UNSET, Response

DEFAULT_BASE_URL = "https://api.ukdataatlas.com/v1"


class AtlasError(Exception):
    """A refusal or failed request.

    `problem` is the RFC 9457 body the API sent, empty if it sent none, and
    `code` is its stable machine-readable `code`, where the refusal has one.
    """

    def __init__(self, status_code: int, body: bytes) -> None:
        try:
            problem = json.loads(body)
        except ValueError:
            problem = None
        self.status_code = status_code
        self.problem: dict[str, Any] = problem if isinstance(problem, dict) else {}
        self.code: str | None = self.problem.get("code")
        detail = self.problem.get("detail") or HTTPStatus(status_code).phrase
        title = self.problem.get("title")
        super().__init__(f"{status_code} {title}: {detail}" if title else f"{status_code} {detail}")


def _ok(response: Response[Any]) -> Any:
    if response.status_code != HTTPStatus.OK:
        raise AtlasError(response.status_code, response.content)
    return response.parsed


class AtlasClient:
    """Ask the UK Data Atlas API a question.

    Query parameters beyond the one the question needs are keyword arguments
    named as in the generated functions, such as `period` or `code_year`.
    `client` is the generated `Client`, for every other route.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        *,
        timeout: float = 30.0,
        headers: dict[str, str] | None = None,
        httpx_args: dict[str, Any] | None = None,
    ) -> None:
        self.client = Client(
            base_url=base_url,
            timeout=httpx.Timeout(timeout),
            headers=headers or {},
            httpx_args=httpx_args or {},
        )

    def __enter__(self) -> Self:
        self.client.__enter__()
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.client.__exit__(*exc_info)

    def places(self, q: str, **query: Any) -> Envelope:
        """Find every place a name, code or postcode could mean."""
        return _ok(resolve_places.sync_detailed(client=self.client, q=q, **query))

    def measures(self, q: str | None = None) -> Envelope:
        """Find a measure by id, alias, label or dataset title."""
        return _ok(list_measures.sync_detailed(client=self.client, q=UNSET if q is None else q))

    def postcode(self, postcode: str, **query: Any) -> PostcodeLookupEnvelope:
        """What a postcode sits in."""
        return _ok(resolve_postcode.sync_detailed(postcode, client=self.client, **query))

    def value(self, measure: str, place: str, **query: Any) -> Envelope:
        """One measure for one place: a name, code, postcode or place reference."""
        return _ok(
            get_measure_value_for_place.sync_detailed(
                measure, client=self.client, place=place, **query
            )
        )

    def series(self, measure: str, place: str, **query: Any) -> Envelope:
        """One measure for one place over time."""
        return _ok(
            get_source_exact_measure_series.sync_detailed(
                measure, client=self.client, place=place, **query
            )
        )
