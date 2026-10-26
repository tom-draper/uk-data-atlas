from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_named_location_geometry_response_200 import (
    GetNamedLocationGeometryResponse200,
)
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    location_id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/locations/{location_id}/geometry".format(
            location_id=quote(str(location_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetNamedLocationGeometryResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetNamedLocationGeometryResponse200.from_dict(response.json())

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
) -> Response[GetNamedLocationGeometryResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetNamedLocationGeometryResponse200 | Problem]:
    """Get a curated area's compiled GeoJSON geometry

     Returns the compiled union geometry for the location's fully resolved member release. It is
    unavailable rather than estimated when no such geometry has been built.

    Args:
        location_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationGeometryResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetNamedLocationGeometryResponse200 | Problem | None:
    """Get a curated area's compiled GeoJSON geometry

     Returns the compiled union geometry for the location's fully resolved member release. It is
    unavailable rather than estimated when no such geometry has been built.

    Args:
        location_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationGeometryResponse200 | Problem
    """

    return sync_detailed(
        location_id=location_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetNamedLocationGeometryResponse200 | Problem]:
    """Get a curated area's compiled GeoJSON geometry

     Returns the compiled union geometry for the location's fully resolved member release. It is
    unavailable rather than estimated when no such geometry has been built.

    Args:
        location_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationGeometryResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetNamedLocationGeometryResponse200 | Problem | None:
    """Get a curated area's compiled GeoJSON geometry

     Returns the compiled union geometry for the location's fully resolved member release. It is
    unavailable rather than estimated when no such geometry has been built.

    Args:
        location_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationGeometryResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            location_id=location_id,
            client=client,
        )
    ).parsed
