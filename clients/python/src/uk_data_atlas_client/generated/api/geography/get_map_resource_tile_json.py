from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...models.tile_json_envelope import TileJsonEnvelope
from ...types import Response


def _get_kwargs(
    geography: str,
    release: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/map-resources/{geography}/{release}/tiles.json".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Problem | TileJsonEnvelope | None:
    if response.status_code == 200:
        response_200 = TileJsonEnvelope.from_dict(response.json())

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
) -> Response[Problem | TileJsonEnvelope]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[Problem | TileJsonEnvelope]:
    """The TileJSON a renderer is configured with

     TileJSON 3.0 for this resource, including the attribution a map must display. A tile cannot carry a
    licence, so a client handed only a tile URL would have nothing to show; this is the document that
    supplies it.

    Args:
        geography (str):
        release (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | TileJsonEnvelope]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
) -> Problem | TileJsonEnvelope | None:
    """The TileJSON a renderer is configured with

     TileJSON 3.0 for this resource, including the attribution a map must display. A tile cannot carry a
    licence, so a client handed only a tile URL would have nothing to show; this is the document that
    supplies it.

    Args:
        geography (str):
        release (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | TileJsonEnvelope
    """

    return sync_detailed(
        geography=geography,
        release=release,
        client=client,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[Problem | TileJsonEnvelope]:
    """The TileJSON a renderer is configured with

     TileJSON 3.0 for this resource, including the attribution a map must display. A tile cannot carry a
    licence, so a client handed only a tile URL would have nothing to show; this is the document that
    supplies it.

    Args:
        geography (str):
        release (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | TileJsonEnvelope]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
) -> Problem | TileJsonEnvelope | None:
    """The TileJSON a renderer is configured with

     TileJSON 3.0 for this resource, including the attribution a map must display. A tile cannot carry a
    licence, so a client handed only a tile URL would have nothing to show; this is the document that
    supplies it.

    Args:
        geography (str):
        release (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | TileJsonEnvelope
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            client=client,
        )
    ).parsed
