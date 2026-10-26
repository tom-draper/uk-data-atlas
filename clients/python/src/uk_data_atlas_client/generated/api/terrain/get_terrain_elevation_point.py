from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_terrain_elevation_point_interpolation import (
    GetTerrainElevationPointInterpolation,
)
from ...models.problem import Problem
from ...models.terrain_point_envelope import TerrainPointEnvelope
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    x: float,
    y: float,
    interpolation: GetTerrainElevationPointInterpolation
    | Unset = GetTerrainElevationPointInterpolation.BILINEAR,
    version: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["x"] = x

    params["y"] = y

    json_interpolation: str | Unset = UNSET
    if not isinstance(interpolation, Unset):
        json_interpolation = interpolation.value

    params["interpolation"] = json_interpolation

    params["version"] = version

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/terrain/elevation/point",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Problem | TerrainPointEnvelope | None:
    if response.status_code == 200:
        response_200 = TerrainPointEnvelope.from_dict(response.json())

        return response_200

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
) -> Response[Problem | TerrainPointEnvelope]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    x: float,
    y: float,
    interpolation: GetTerrainElevationPointInterpolation
    | Unset = GetTerrainElevationPointInterpolation.BILINEAR,
    version: str | Unset = UNSET,
) -> Response[Problem | TerrainPointEnvelope]:
    """Get one terrain elevation point

     Returns a bare-earth elevation sampled in British National Grid metres. The answer identifies the
    exact source version and tile hash used. An outside-coverage or no-data point is a successful
    response with an explicit status; neither is converted into a plausible elevation. This endpoint
    requires a configured terrain provider and does not imply that the catalogue's planned products are
    published.

    Args:
        x (float):
        y (float):
        interpolation (GetTerrainElevationPointInterpolation | Unset):  Default:
            GetTerrainElevationPointInterpolation.BILINEAR.
        version (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | TerrainPointEnvelope]
    """

    kwargs = _get_kwargs(
        x=x,
        y=y,
        interpolation=interpolation,
        version=version,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    x: float,
    y: float,
    interpolation: GetTerrainElevationPointInterpolation
    | Unset = GetTerrainElevationPointInterpolation.BILINEAR,
    version: str | Unset = UNSET,
) -> Problem | TerrainPointEnvelope | None:
    """Get one terrain elevation point

     Returns a bare-earth elevation sampled in British National Grid metres. The answer identifies the
    exact source version and tile hash used. An outside-coverage or no-data point is a successful
    response with an explicit status; neither is converted into a plausible elevation. This endpoint
    requires a configured terrain provider and does not imply that the catalogue's planned products are
    published.

    Args:
        x (float):
        y (float):
        interpolation (GetTerrainElevationPointInterpolation | Unset):  Default:
            GetTerrainElevationPointInterpolation.BILINEAR.
        version (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | TerrainPointEnvelope
    """

    return sync_detailed(
        client=client,
        x=x,
        y=y,
        interpolation=interpolation,
        version=version,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    x: float,
    y: float,
    interpolation: GetTerrainElevationPointInterpolation
    | Unset = GetTerrainElevationPointInterpolation.BILINEAR,
    version: str | Unset = UNSET,
) -> Response[Problem | TerrainPointEnvelope]:
    """Get one terrain elevation point

     Returns a bare-earth elevation sampled in British National Grid metres. The answer identifies the
    exact source version and tile hash used. An outside-coverage or no-data point is a successful
    response with an explicit status; neither is converted into a plausible elevation. This endpoint
    requires a configured terrain provider and does not imply that the catalogue's planned products are
    published.

    Args:
        x (float):
        y (float):
        interpolation (GetTerrainElevationPointInterpolation | Unset):  Default:
            GetTerrainElevationPointInterpolation.BILINEAR.
        version (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | TerrainPointEnvelope]
    """

    kwargs = _get_kwargs(
        x=x,
        y=y,
        interpolation=interpolation,
        version=version,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    x: float,
    y: float,
    interpolation: GetTerrainElevationPointInterpolation
    | Unset = GetTerrainElevationPointInterpolation.BILINEAR,
    version: str | Unset = UNSET,
) -> Problem | TerrainPointEnvelope | None:
    """Get one terrain elevation point

     Returns a bare-earth elevation sampled in British National Grid metres. The answer identifies the
    exact source version and tile hash used. An outside-coverage or no-data point is a successful
    response with an explicit status; neither is converted into a plausible elevation. This endpoint
    requires a configured terrain provider and does not imply that the catalogue's planned products are
    published.

    Args:
        x (float):
        y (float):
        interpolation (GetTerrainElevationPointInterpolation | Unset):  Default:
            GetTerrainElevationPointInterpolation.BILINEAR.
        version (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | TerrainPointEnvelope
    """

    return (
        await asyncio_detailed(
            client=client,
            x=x,
            y=y,
            interpolation=interpolation,
            version=version,
        )
    ).parsed
