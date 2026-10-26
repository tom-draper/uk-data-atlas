from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.find_containing_areas_for_points_body import (
    FindContainingAreasForPointsBody,
)
from ...models.find_containing_areas_for_points_crs import (
    FindContainingAreasForPointsCrs,
)
from ...models.point_containment_batch_envelope import PointContainmentBatchEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: FindContainingAreasForPointsBody,
    crs: FindContainingAreasForPointsCrs
    | Unset = FindContainingAreasForPointsCrs.EPSG4326,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    json_crs: str | Unset = UNSET
    if not isinstance(crs, Unset):
        json_crs = crs.value

    params["crs"] = json_crs

    json_geography: list[str] | Unset = UNSET
    if not isinstance(geography, Unset):
        json_geography = geography

    params["geography"] = json_geography

    json_release: list[str] | Unset = UNSET
    if not isinstance(release, Unset):
        json_release = release

    params["release"] = json_release

    params["date"] = date

    params["accuracy"] = accuracy

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/areas:containsBatch",
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PointContainmentBatchEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = PointContainmentBatchEnvelope.from_dict(response.json())

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
) -> Response[PointContainmentBatchEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: FindContainingAreasForPointsBody,
    crs: FindContainingAreasForPointsCrs
    | Unset = FindContainingAreasForPointsCrs.EPSG4326,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> Response[PointContainmentBatchEnvelope | Problem]:
    """Find the areas containing each of a bounded batch of points

     The `areas:contains` lookup for up to 100 points at once, each given in the JSON body's `points`
    array as `{lng},{lat}` or `{lng},{lat},{accuracy}` in the default WGS 84, as
    `point={easting},{northing}` with `crs=EPSG:27700` or `EPSG:29902`, or as one Ordnance Survey
    reference such as `point=TQ3000080000` with `crs=EPSG:27700`. Geographies, release selection and
    statuses are exactly as for a single point.

    Release-wide facts, including selection, coverage, resolution and geometry provenance, are given
    once in `releases`. Each point then lists its country and, per release in the same order, its status
    and matches; a match carries `corrections` only where a declared grid correction moved that area.
    `summary` counts the lookups by outcome and how many have a match near a boundary.

    Every release is read once for all the points, so the cost of a batch grows with its points rather
    than with its points times its geographies. This is a bounded convenience for a caller's own point
    dataset, not a bulk geocoder: for more points, page through them in batches.

    Args:
        crs (FindContainingAreasForPointsCrs | Unset):  Default:
            FindContainingAreasForPointsCrs.EPSG4326.
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        body (FindContainingAreasForPointsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PointContainmentBatchEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        body=body,
        crs=crs,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: FindContainingAreasForPointsBody,
    crs: FindContainingAreasForPointsCrs
    | Unset = FindContainingAreasForPointsCrs.EPSG4326,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> PointContainmentBatchEnvelope | Problem | None:
    """Find the areas containing each of a bounded batch of points

     The `areas:contains` lookup for up to 100 points at once, each given in the JSON body's `points`
    array as `{lng},{lat}` or `{lng},{lat},{accuracy}` in the default WGS 84, as
    `point={easting},{northing}` with `crs=EPSG:27700` or `EPSG:29902`, or as one Ordnance Survey
    reference such as `point=TQ3000080000` with `crs=EPSG:27700`. Geographies, release selection and
    statuses are exactly as for a single point.

    Release-wide facts, including selection, coverage, resolution and geometry provenance, are given
    once in `releases`. Each point then lists its country and, per release in the same order, its status
    and matches; a match carries `corrections` only where a declared grid correction moved that area.
    `summary` counts the lookups by outcome and how many have a match near a boundary.

    Every release is read once for all the points, so the cost of a batch grows with its points rather
    than with its points times its geographies. This is a bounded convenience for a caller's own point
    dataset, not a bulk geocoder: for more points, page through them in batches.

    Args:
        crs (FindContainingAreasForPointsCrs | Unset):  Default:
            FindContainingAreasForPointsCrs.EPSG4326.
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        body (FindContainingAreasForPointsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PointContainmentBatchEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        body=body,
        crs=crs,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: FindContainingAreasForPointsBody,
    crs: FindContainingAreasForPointsCrs
    | Unset = FindContainingAreasForPointsCrs.EPSG4326,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> Response[PointContainmentBatchEnvelope | Problem]:
    """Find the areas containing each of a bounded batch of points

     The `areas:contains` lookup for up to 100 points at once, each given in the JSON body's `points`
    array as `{lng},{lat}` or `{lng},{lat},{accuracy}` in the default WGS 84, as
    `point={easting},{northing}` with `crs=EPSG:27700` or `EPSG:29902`, or as one Ordnance Survey
    reference such as `point=TQ3000080000` with `crs=EPSG:27700`. Geographies, release selection and
    statuses are exactly as for a single point.

    Release-wide facts, including selection, coverage, resolution and geometry provenance, are given
    once in `releases`. Each point then lists its country and, per release in the same order, its status
    and matches; a match carries `corrections` only where a declared grid correction moved that area.
    `summary` counts the lookups by outcome and how many have a match near a boundary.

    Every release is read once for all the points, so the cost of a batch grows with its points rather
    than with its points times its geographies. This is a bounded convenience for a caller's own point
    dataset, not a bulk geocoder: for more points, page through them in batches.

    Args:
        crs (FindContainingAreasForPointsCrs | Unset):  Default:
            FindContainingAreasForPointsCrs.EPSG4326.
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        body (FindContainingAreasForPointsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PointContainmentBatchEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        body=body,
        crs=crs,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: FindContainingAreasForPointsBody,
    crs: FindContainingAreasForPointsCrs
    | Unset = FindContainingAreasForPointsCrs.EPSG4326,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> PointContainmentBatchEnvelope | Problem | None:
    """Find the areas containing each of a bounded batch of points

     The `areas:contains` lookup for up to 100 points at once, each given in the JSON body's `points`
    array as `{lng},{lat}` or `{lng},{lat},{accuracy}` in the default WGS 84, as
    `point={easting},{northing}` with `crs=EPSG:27700` or `EPSG:29902`, or as one Ordnance Survey
    reference such as `point=TQ3000080000` with `crs=EPSG:27700`. Geographies, release selection and
    statuses are exactly as for a single point.

    Release-wide facts, including selection, coverage, resolution and geometry provenance, are given
    once in `releases`. Each point then lists its country and, per release in the same order, its status
    and matches; a match carries `corrections` only where a declared grid correction moved that area.
    `summary` counts the lookups by outcome and how many have a match near a boundary.

    Every release is read once for all the points, so the cost of a batch grows with its points rather
    than with its points times its geographies. This is a bounded convenience for a caller's own point
    dataset, not a bulk geocoder: for more points, page through them in batches.

    Args:
        crs (FindContainingAreasForPointsCrs | Unset):  Default:
            FindContainingAreasForPointsCrs.EPSG4326.
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        body (FindContainingAreasForPointsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PointContainmentBatchEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            crs=crs,
            geography=geography,
            release=release,
            date=date,
            accuracy=accuracy,
        )
    ).parsed
