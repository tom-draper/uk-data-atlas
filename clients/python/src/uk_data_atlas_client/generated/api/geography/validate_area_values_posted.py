from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...models.validate_area_values_posted_json_body import (
    ValidateAreaValuesPostedJsonBody,
)
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: ValidateAreaValuesPostedJsonBody,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["release"] = release

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/areas:validate",
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Envelope | Problem | None:
    if response.status_code == 200:
        response_200 = Envelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 413:
        response_413 = Problem.from_dict(response.json())

        return response_413

    if response.status_code == 415:
        response_415 = Problem.from_dict(response.json())

        return response_415

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Envelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ValidateAreaValuesPostedJsonBody,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Validate a whole column of area codes or names sent as the body

     The same check as the GET, for a column longer than a URL holds: up to 250,000 values in an 8 MiB
    body. Send JSON, `{"values": ["E05000650", "Bristol"], "parents": [...]}` or `{"rows": [{"area":
    "Bristol", "parent": "..."}]}`, or CSV with a header row naming the column `area`, `code`, `name` or
    `value`, and optionally a `parent` column. `geography` and `release` stay in the query, as on the
    GET, and the answer is exactly the GET's for the same values. It is never cached, since it depends
    on the body.

    Args:
        geography (str | Unset):
        release (str | Unset):
        body (ValidateAreaValuesPostedJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        body=body,
        geography=geography,
        release=release,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: ValidateAreaValuesPostedJsonBody,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
) -> Envelope | Problem | None:
    """Validate a whole column of area codes or names sent as the body

     The same check as the GET, for a column longer than a URL holds: up to 250,000 values in an 8 MiB
    body. Send JSON, `{"values": ["E05000650", "Bristol"], "parents": [...]}` or `{"rows": [{"area":
    "Bristol", "parent": "..."}]}`, or CSV with a header row naming the column `area`, `code`, `name` or
    `value`, and optionally a `parent` column. `geography` and `release` stay in the query, as on the
    GET, and the answer is exactly the GET's for the same values. It is never cached, since it depends
    on the body.

    Args:
        geography (str | Unset):
        release (str | Unset):
        body (ValidateAreaValuesPostedJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        client=client,
        body=body,
        geography=geography,
        release=release,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ValidateAreaValuesPostedJsonBody,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Validate a whole column of area codes or names sent as the body

     The same check as the GET, for a column longer than a URL holds: up to 250,000 values in an 8 MiB
    body. Send JSON, `{"values": ["E05000650", "Bristol"], "parents": [...]}` or `{"rows": [{"area":
    "Bristol", "parent": "..."}]}`, or CSV with a header row naming the column `area`, `code`, `name` or
    `value`, and optionally a `parent` column. `geography` and `release` stay in the query, as on the
    GET, and the answer is exactly the GET's for the same values. It is never cached, since it depends
    on the body.

    Args:
        geography (str | Unset):
        release (str | Unset):
        body (ValidateAreaValuesPostedJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        body=body,
        geography=geography,
        release=release,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: ValidateAreaValuesPostedJsonBody,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
) -> Envelope | Problem | None:
    """Validate a whole column of area codes or names sent as the body

     The same check as the GET, for a column longer than a URL holds: up to 250,000 values in an 8 MiB
    body. Send JSON, `{"values": ["E05000650", "Bristol"], "parents": [...]}` or `{"rows": [{"area":
    "Bristol", "parent": "..."}]}`, or CSV with a header row naming the column `area`, `code`, `name` or
    `value`, and optionally a `parent` column. `geography` and `release` stay in the query, as on the
    GET, and the answer is exactly the GET's for the same values. It is never cached, since it depends
    on the body.

    Args:
        geography (str | Unset):
        release (str | Unset):
        body (ValidateAreaValuesPostedJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            geography=geography,
            release=release,
        )
    ).parsed
