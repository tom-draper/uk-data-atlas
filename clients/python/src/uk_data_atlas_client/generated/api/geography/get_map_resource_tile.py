from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    geography: str,
    release: str,
    z: int,
    x: int,
    y: int,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            z=quote(str(z), safe=""),
            x=quote(str(x), safe=""),
            y=quote(str(y), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | Problem | None:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

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
) -> Response[Any | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    geography: str,
    release: str,
    z: int,
    x: int,
    y: int,
    *,
    client: AuthenticatedClient | Client,
) -> Response[Any | Problem]:
    """One vector tile of a boundary release

     A Mapbox Vector Tile carrying the `boundaries` layer, gzipped as the archive stores it. Each feature
    has the area's `code`, its `name` and a stable integer id a renderer can hold state against. Values
    are not in the tile: one tileset serves every measure, and a value is joined in the renderer. A tile
    inside the published zooms that covers no area is answered `204`, which is an ordinary answer rather
    than a failure; a zoom the resource does not publish is `404`, and a renderer should over-zoom past
    the last one instead.

    Args:
        geography (str):
        release (str):
        z (int):
        x (int):
        y (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        z=z,
        x=x,
        y=y,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography: str,
    release: str,
    z: int,
    x: int,
    y: int,
    *,
    client: AuthenticatedClient | Client,
) -> Any | Problem | None:
    """One vector tile of a boundary release

     A Mapbox Vector Tile carrying the `boundaries` layer, gzipped as the archive stores it. Each feature
    has the area's `code`, its `name` and a stable integer id a renderer can hold state against. Values
    are not in the tile: one tileset serves every measure, and a value is joined in the renderer. A tile
    inside the published zooms that covers no area is answered `204`, which is an ordinary answer rather
    than a failure; a zoom the resource does not publish is `404`, and a renderer should over-zoom past
    the last one instead.

    Args:
        geography (str):
        release (str):
        z (int):
        x (int):
        y (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        z=z,
        x=x,
        y=y,
        client=client,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    z: int,
    x: int,
    y: int,
    *,
    client: AuthenticatedClient | Client,
) -> Response[Any | Problem]:
    """One vector tile of a boundary release

     A Mapbox Vector Tile carrying the `boundaries` layer, gzipped as the archive stores it. Each feature
    has the area's `code`, its `name` and a stable integer id a renderer can hold state against. Values
    are not in the tile: one tileset serves every measure, and a value is joined in the renderer. A tile
    inside the published zooms that covers no area is answered `204`, which is an ordinary answer rather
    than a failure; a zoom the resource does not publish is `404`, and a renderer should over-zoom past
    the last one instead.

    Args:
        geography (str):
        release (str):
        z (int):
        x (int):
        y (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        z=z,
        x=x,
        y=y,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    z: int,
    x: int,
    y: int,
    *,
    client: AuthenticatedClient | Client,
) -> Any | Problem | None:
    """One vector tile of a boundary release

     A Mapbox Vector Tile carrying the `boundaries` layer, gzipped as the archive stores it. Each feature
    has the area's `code`, its `name` and a stable integer id a renderer can hold state against. Values
    are not in the tile: one tileset serves every measure, and a value is joined in the renderer. A tile
    inside the published zooms that covers no area is answered `204`, which is an ordinary answer rather
    than a failure; a zoom the resource does not publish is `404`, and a renderer should over-zoom past
    the last one instead.

    Args:
        geography (str):
        release (str):
        z (int):
        x (int):
        y (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            z=z,
            x=x,
            y=y,
            client=client,
        )
    ).parsed
