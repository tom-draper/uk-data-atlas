from http import HTTPStatus
from io import BytesIO
from typing import Any, cast
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...types import UNSET, File, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    *,
    range_: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(range_, Unset):
        headers["Range"] = range_

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/map-resources/{geography}/{release}.pmtiles".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
        ),
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | File | Problem | None:
    if response.status_code == 206:
        response_206 = File(payload=BytesIO(response.content))

        return response_206

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 416:
        response_416 = cast(Any, None)
        return response_416

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | File | Problem]:
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
    range_: str | Unset = UNSET,
) -> Response[Any | File | Problem]:
    """The whole tile pyramid as one PMTiles archive

     Every tile of the resource in a single PMTiles v3 file, for an offline map, a CDN or a warehouse.
    Its SHA-256 is the `contentHash` the descriptor publishes, so a drawing made from it can be tied to
    the Atlas release that produced it.
    It can also be read in place: the archive honours byte-range requests, so a map library such as
    MapLibre with the `pmtiles` protocol can draw from this URL directly, fetching only the tiles in
    view.

    Args:
        geography (str):
        release (str):
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | File | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        range_=range_,
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
    range_: str | Unset = UNSET,
) -> Any | File | Problem | None:
    """The whole tile pyramid as one PMTiles archive

     Every tile of the resource in a single PMTiles v3 file, for an offline map, a CDN or a warehouse.
    Its SHA-256 is the `contentHash` the descriptor publishes, so a drawing made from it can be tied to
    the Atlas release that produced it.
    It can also be read in place: the archive honours byte-range requests, so a map library such as
    MapLibre with the `pmtiles` protocol can draw from this URL directly, fetching only the tiles in
    view.

    Args:
        geography (str):
        release (str):
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | File | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        client=client,
        range_=range_,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    range_: str | Unset = UNSET,
) -> Response[Any | File | Problem]:
    """The whole tile pyramid as one PMTiles archive

     Every tile of the resource in a single PMTiles v3 file, for an offline map, a CDN or a warehouse.
    Its SHA-256 is the `contentHash` the descriptor publishes, so a drawing made from it can be tied to
    the Atlas release that produced it.
    It can also be read in place: the archive honours byte-range requests, so a map library such as
    MapLibre with the `pmtiles` protocol can draw from this URL directly, fetching only the tiles in
    view.

    Args:
        geography (str):
        release (str):
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | File | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        range_=range_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    range_: str | Unset = UNSET,
) -> Any | File | Problem | None:
    """The whole tile pyramid as one PMTiles archive

     Every tile of the resource in a single PMTiles v3 file, for an offline map, a CDN or a warehouse.
    Its SHA-256 is the `contentHash` the descriptor publishes, so a drawing made from it can be tied to
    the Atlas release that produced it.
    It can also be read in place: the archive honours byte-range requests, so a map library such as
    MapLibre with the `pmtiles` protocol can draw from this URL directly, fetching only the tiles in
    view.

    Args:
        geography (str):
        release (str):
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | File | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            client=client,
            range_=range_,
        )
    ).parsed
