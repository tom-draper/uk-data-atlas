from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.map_resource_list_envelope import MapResourceListEnvelope
from ...models.problem import Problem
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/map-resources",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> MapResourceListEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = MapResourceListEnvelope.from_dict(response.json())

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
) -> Response[MapResourceListEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[MapResourceListEnvelope | Problem]:
    """List the boundary releases published as map resources

     A map resource is one boundary release prepared for drawing: tiles whose borders are compiled once
    and shared, so neighbours cannot be drawn two different ways. Releases are published deliberately
    rather than every release being tiled: most are, but a release served only as area records, such as
    the 2022 Scottish data zones, is not listed.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[MapResourceListEnvelope | Problem]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> MapResourceListEnvelope | Problem | None:
    """List the boundary releases published as map resources

     A map resource is one boundary release prepared for drawing: tiles whose borders are compiled once
    and shared, so neighbours cannot be drawn two different ways. Releases are published deliberately
    rather than every release being tiled: most are, but a release served only as area records, such as
    the 2022 Scottish data zones, is not listed.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        MapResourceListEnvelope | Problem
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[MapResourceListEnvelope | Problem]:
    """List the boundary releases published as map resources

     A map resource is one boundary release prepared for drawing: tiles whose borders are compiled once
    and shared, so neighbours cannot be drawn two different ways. Releases are published deliberately
    rather than every release being tiled: most are, but a release served only as area records, such as
    the 2022 Scottish data zones, is not listed.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[MapResourceListEnvelope | Problem]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> MapResourceListEnvelope | Problem | None:
    """List the boundary releases published as map resources

     A map resource is one boundary release prepared for drawing: tiles whose borders are compiled once
    and shared, so neighbours cannot be drawn two different ways. Releases are published deliberately
    rather than every release being tiled: most are, but a release served only as area records, such as
    the 2022 Scottish data zones, is not listed.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        MapResourceListEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
