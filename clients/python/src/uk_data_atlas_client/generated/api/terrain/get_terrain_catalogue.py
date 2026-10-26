from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/terrain",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Envelope | Problem | None:
    if response.status_code == 200:
        response_200 = Envelope.from_dict(response.json())

        return response_200

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

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
) -> Response[Envelope | Problem]:
    """Discover terrain product families and their availability

     The terrain catalogue distinguishes bare-earth elevation (a digital terrain model) from surface
    elevation (a digital surface model), and declares slope, aspect, contours and hillshade separately.
    A product marked `not-published` has no values, tiles or contours to fetch; it exists so a client
    can discover the service boundary without treating a planned layer as data. Before a product becomes
    available, its version must state its CRS, vertical datum, resolution, processing, uncertainty,
    licence and immutable content hash.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> Envelope | Problem | None:
    """Discover terrain product families and their availability

     The terrain catalogue distinguishes bare-earth elevation (a digital terrain model) from surface
    elevation (a digital surface model), and declares slope, aspect, contours and hillshade separately.
    A product marked `not-published` has no values, tiles or contours to fetch; it exists so a client
    can discover the service boundary without treating a planned layer as data. Before a product becomes
    available, its version must state its CRS, vertical datum, resolution, processing, uncertainty,
    licence and immutable content hash.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[Envelope | Problem]:
    """Discover terrain product families and their availability

     The terrain catalogue distinguishes bare-earth elevation (a digital terrain model) from surface
    elevation (a digital surface model), and declares slope, aspect, contours and hillshade separately.
    A product marked `not-published` has no values, tiles or contours to fetch; it exists so a client
    can discover the service boundary without treating a planned layer as data. Before a product becomes
    available, its version must state its CRS, vertical datum, resolution, processing, uncertainty,
    licence and immutable content hash.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> Envelope | Problem | None:
    """Discover terrain product families and their availability

     The terrain catalogue distinguishes bare-earth elevation (a digital terrain model) from surface
    elevation (a digital surface model), and declares slope, aspect, contours and hillshade separately.
    A product marked `not-published` has no values, tiles or contours to fetch; it exists so a client
    can discover the service boundary without treating a planned layer as data. Before a product becomes
    available, its version must state its CRS, vertical datum, resolution, processing, uncertainty,
    licence and immutable content hash.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
