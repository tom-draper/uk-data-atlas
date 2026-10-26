from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_atlas_page_response_200 import GetAtlasPageResponse200
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    page_id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/atlas-pages/{page_id}.json".format(
            page_id=quote(str(page_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetAtlasPageResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetAtlasPageResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetAtlasPageResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    page_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetAtlasPageResponse200 | Problem]:
    """Download a website place profile or catalogue artifact

     API-built website artifacts. Available ids include `places-index`, `places-area-{shard}`, `places-
    named-{id}`, `place-facts`, `ward-areas` and `docs-catalogue`. These shapes follow the website and
    may change with it. Use the area and catalogue routes for stable domain responses.

    Args:
        page_id (str): A page id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetAtlasPageResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        page_id=page_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    page_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetAtlasPageResponse200 | Problem | None:
    """Download a website place profile or catalogue artifact

     API-built website artifacts. Available ids include `places-index`, `places-area-{shard}`, `places-
    named-{id}`, `place-facts`, `ward-areas` and `docs-catalogue`. These shapes follow the website and
    may change with it. Use the area and catalogue routes for stable domain responses.

    Args:
        page_id (str): A page id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetAtlasPageResponse200 | Problem
    """

    return sync_detailed(
        page_id=page_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    page_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetAtlasPageResponse200 | Problem]:
    """Download a website place profile or catalogue artifact

     API-built website artifacts. Available ids include `places-index`, `places-area-{shard}`, `places-
    named-{id}`, `place-facts`, `ward-areas` and `docs-catalogue`. These shapes follow the website and
    may change with it. Use the area and catalogue routes for stable domain responses.

    Args:
        page_id (str): A page id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetAtlasPageResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        page_id=page_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    page_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetAtlasPageResponse200 | Problem | None:
    """Download a website place profile or catalogue artifact

     API-built website artifacts. Available ids include `places-index`, `places-area-{shard}`, `places-
    named-{id}`, `place-facts`, `ward-areas` and `docs-catalogue`. These shapes follow the website and
    may change with it. Use the area and catalogue routes for stable domain responses.

    Args:
        page_id (str): A page id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetAtlasPageResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            page_id=page_id,
            client=client,
        )
    ).parsed
