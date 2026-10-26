from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.find_nearest_areas_crs import FindNearestAreasCrs
from ...models.nearest_areas_envelope import NearestAreasEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindNearestAreasCrs | Unset = FindNearestAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
    limit: int | Unset = 1,
    within: int | Unset = 1000,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["lng"] = lng

    params["lon"] = lon

    params["longitude"] = longitude

    params["lat"] = lat

    json_crs: str | Unset = UNSET
    if not isinstance(crs, Unset):
        json_crs = crs.value

    params["crs"] = json_crs

    params["easting"] = easting

    params["northing"] = northing

    params["gridref"] = gridref

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

    params["limit"] = limit

    params["within"] = within

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas:near",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> NearestAreasEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = NearestAreasEnvelope.from_dict(response.json())

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
) -> Response[NearestAreasEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindNearestAreasCrs | Unset = FindNearestAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
    limit: int | Unset = 1,
    within: int | Unset = 1000,
) -> Response[NearestAreasEnvelope | Problem]:
    """Rank the areas nearest a point by distance

     Returns up to `limit` areas of each requested geography whose published geometry lies within
    `within` metres of the point, nearest first. Releases are selected exactly as for `areas:contains`.

    The coordinate forms are the same as `areas:contains`: default WGS 84 `lng`/`lat` (`lon` and
    `longitude` are also accepted for longitude), British National Grid `easting`/`northing` or an
    Ordnance Survey `gridref` with `crs=EPSG:27700`, or Irish Grid metres with `crs=EPSG:29902`.

    This is a distance answer, labelled `relation: distance`, and never a containment one. An area at
    zero metres has the point on or inside it, but only `areas:contains` makes that claim, with its
    boundary rule and tolerance. Use this route where containment has nothing to say: a point offshore
    or in an estuary that a generalised boundary leaves out, or a site for which the nearest few areas
    all matter.

    Distances are to the nearest part of each area's geometry, measured on the WGS 84 ellipsoid in a
    plane tangent at the point, which within the 50 km this route reaches departs from the geodesic by
    less than a tenth of a percent. They carry the coordinate's own uncertainty, given in
    `point.precision`. `matched` counts every area within the distance, and `truncated` says whether
    `limit` cut it.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindNearestAreasCrs | Unset):  Default: FindNearestAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        limit (int | Unset):  Default: 1.
        within (int | Unset):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[NearestAreasEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        lng=lng,
        lon=lon,
        longitude=longitude,
        lat=lat,
        crs=crs,
        easting=easting,
        northing=northing,
        gridref=gridref,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
        limit=limit,
        within=within,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindNearestAreasCrs | Unset = FindNearestAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
    limit: int | Unset = 1,
    within: int | Unset = 1000,
) -> NearestAreasEnvelope | Problem | None:
    """Rank the areas nearest a point by distance

     Returns up to `limit` areas of each requested geography whose published geometry lies within
    `within` metres of the point, nearest first. Releases are selected exactly as for `areas:contains`.

    The coordinate forms are the same as `areas:contains`: default WGS 84 `lng`/`lat` (`lon` and
    `longitude` are also accepted for longitude), British National Grid `easting`/`northing` or an
    Ordnance Survey `gridref` with `crs=EPSG:27700`, or Irish Grid metres with `crs=EPSG:29902`.

    This is a distance answer, labelled `relation: distance`, and never a containment one. An area at
    zero metres has the point on or inside it, but only `areas:contains` makes that claim, with its
    boundary rule and tolerance. Use this route where containment has nothing to say: a point offshore
    or in an estuary that a generalised boundary leaves out, or a site for which the nearest few areas
    all matter.

    Distances are to the nearest part of each area's geometry, measured on the WGS 84 ellipsoid in a
    plane tangent at the point, which within the 50 km this route reaches departs from the geodesic by
    less than a tenth of a percent. They carry the coordinate's own uncertainty, given in
    `point.precision`. `matched` counts every area within the distance, and `truncated` says whether
    `limit` cut it.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindNearestAreasCrs | Unset):  Default: FindNearestAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        limit (int | Unset):  Default: 1.
        within (int | Unset):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        NearestAreasEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        lng=lng,
        lon=lon,
        longitude=longitude,
        lat=lat,
        crs=crs,
        easting=easting,
        northing=northing,
        gridref=gridref,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
        limit=limit,
        within=within,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindNearestAreasCrs | Unset = FindNearestAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
    limit: int | Unset = 1,
    within: int | Unset = 1000,
) -> Response[NearestAreasEnvelope | Problem]:
    """Rank the areas nearest a point by distance

     Returns up to `limit` areas of each requested geography whose published geometry lies within
    `within` metres of the point, nearest first. Releases are selected exactly as for `areas:contains`.

    The coordinate forms are the same as `areas:contains`: default WGS 84 `lng`/`lat` (`lon` and
    `longitude` are also accepted for longitude), British National Grid `easting`/`northing` or an
    Ordnance Survey `gridref` with `crs=EPSG:27700`, or Irish Grid metres with `crs=EPSG:29902`.

    This is a distance answer, labelled `relation: distance`, and never a containment one. An area at
    zero metres has the point on or inside it, but only `areas:contains` makes that claim, with its
    boundary rule and tolerance. Use this route where containment has nothing to say: a point offshore
    or in an estuary that a generalised boundary leaves out, or a site for which the nearest few areas
    all matter.

    Distances are to the nearest part of each area's geometry, measured on the WGS 84 ellipsoid in a
    plane tangent at the point, which within the 50 km this route reaches departs from the geodesic by
    less than a tenth of a percent. They carry the coordinate's own uncertainty, given in
    `point.precision`. `matched` counts every area within the distance, and `truncated` says whether
    `limit` cut it.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindNearestAreasCrs | Unset):  Default: FindNearestAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        limit (int | Unset):  Default: 1.
        within (int | Unset):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[NearestAreasEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        lng=lng,
        lon=lon,
        longitude=longitude,
        lat=lat,
        crs=crs,
        easting=easting,
        northing=northing,
        gridref=gridref,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
        limit=limit,
        within=within,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindNearestAreasCrs | Unset = FindNearestAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
    limit: int | Unset = 1,
    within: int | Unset = 1000,
) -> NearestAreasEnvelope | Problem | None:
    """Rank the areas nearest a point by distance

     Returns up to `limit` areas of each requested geography whose published geometry lies within
    `within` metres of the point, nearest first. Releases are selected exactly as for `areas:contains`.

    The coordinate forms are the same as `areas:contains`: default WGS 84 `lng`/`lat` (`lon` and
    `longitude` are also accepted for longitude), British National Grid `easting`/`northing` or an
    Ordnance Survey `gridref` with `crs=EPSG:27700`, or Irish Grid metres with `crs=EPSG:29902`.

    This is a distance answer, labelled `relation: distance`, and never a containment one. An area at
    zero metres has the point on or inside it, but only `areas:contains` makes that claim, with its
    boundary rule and tolerance. Use this route where containment has nothing to say: a point offshore
    or in an estuary that a generalised boundary leaves out, or a site for which the nearest few areas
    all matter.

    Distances are to the nearest part of each area's geometry, measured on the WGS 84 ellipsoid in a
    plane tangent at the point, which within the 50 km this route reaches departs from the geodesic by
    less than a tenth of a percent. They carry the coordinate's own uncertainty, given in
    `point.precision`. `matched` counts every area within the distance, and `truncated` says whether
    `limit` cut it.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindNearestAreasCrs | Unset):  Default: FindNearestAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):
        limit (int | Unset):  Default: 1.
        within (int | Unset):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        NearestAreasEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            lng=lng,
            lon=lon,
            longitude=longitude,
            lat=lat,
            crs=crs,
            easting=easting,
            northing=northing,
            gridref=gridref,
            geography=geography,
            release=release,
            date=date,
            accuracy=accuracy,
            limit=limit,
            within=within,
        )
    ).parsed
