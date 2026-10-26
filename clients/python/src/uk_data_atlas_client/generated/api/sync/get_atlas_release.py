from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.atlas_release_envelope import AtlasReleaseEnvelope
from ...models.problem import Problem
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/atlas-release",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AtlasReleaseEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AtlasReleaseEnvelope.from_dict(response.json())

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
) -> Response[AtlasReleaseEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[AtlasReleaseEnvelope | Problem]:
    """Get the current build manifest

     Identifies the current build by hashes of atlas.sqlite, boundary PMTiles, and catalogues still
    served as JSON. Export and map catalogues describe the observation and flat boundary downloads.
    Paths are relative to the repository root and hashes cover the actual on-disk bytes, including gzip
    encoding where present. The API retains no earlier builds. JSON intermediates already represented in
    SQLite are omitted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AtlasReleaseEnvelope | Problem]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> AtlasReleaseEnvelope | Problem | None:
    """Get the current build manifest

     Identifies the current build by hashes of atlas.sqlite, boundary PMTiles, and catalogues still
    served as JSON. Export and map catalogues describe the observation and flat boundary downloads.
    Paths are relative to the repository root and hashes cover the actual on-disk bytes, including gzip
    encoding where present. The API retains no earlier builds. JSON intermediates already represented in
    SQLite are omitted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AtlasReleaseEnvelope | Problem
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[AtlasReleaseEnvelope | Problem]:
    """Get the current build manifest

     Identifies the current build by hashes of atlas.sqlite, boundary PMTiles, and catalogues still
    served as JSON. Export and map catalogues describe the observation and flat boundary downloads.
    Paths are relative to the repository root and hashes cover the actual on-disk bytes, including gzip
    encoding where present. The API retains no earlier builds. JSON intermediates already represented in
    SQLite are omitted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AtlasReleaseEnvelope | Problem]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> AtlasReleaseEnvelope | Problem | None:
    """Get the current build manifest

     Identifies the current build by hashes of atlas.sqlite, boundary PMTiles, and catalogues still
    served as JSON. Export and map catalogues describe the observation and flat boundary downloads.
    Paths are relative to the repository root and hashes cover the actual on-disk bytes, including gzip
    encoding where present. The API retains no earlier builds. JSON intermediates already represented in
    SQLite are omitted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AtlasReleaseEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
