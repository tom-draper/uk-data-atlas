from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.find_containing_areas_crs import FindContainingAreasCrs
from ...models.point_containment_envelope import PointContainmentEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindContainingAreasCrs | Unset = FindContainingAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
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

    params["postcode"] = postcode

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
        "method": "get",
        "url": "/areas:contains",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PointContainmentEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = PointContainmentEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 451:
        response_451 = Problem.from_dict(response.json())

        return response_451

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PointContainmentEnvelope | Problem]:
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
    crs: FindContainingAreasCrs | Unset = FindContainingAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> Response[PointContainmentEnvelope | Problem]:
    """Find the areas containing a point in one or more geographies

     Tests a point against one boundary release of each requested geography, at most four in one request,
    and says for each what contains it or why nothing does.

    Supply WGS 84 `lng` (also accepted as `lon` or `longitude`) and `lat` (the default), or set
    `crs=EPSG:27700` and supply British National Grid `easting` and `northing` or an Ordnance Survey
    `gridref` such as `TQ 30000 80000`. Set `crs=EPSG:29902` for Irish Grid metres. Or give a unit
    `postcode` instead of a coordinate: it is placed by its ONS Postcode Directory centroid, with the
    directory's own stated accuracy, exactly as `/postcodes/{postcode}` places it, and the answer names
    the postcode. A grid reference denotes a square, so its answer uses the cell centre and includes its
    whole half-diagonal as uncertainty. Every answer is normalised to WGS 84 and retains the input
    coordinate and named transformation.

    Each geography's release is either pinned, as `release={geography}/{release}`, chosen for `date` as
    the latest one dated on or before it, or defaults to the newest unambiguous published release. With
    neither `geography` nor `release`, the lookup covers `localAuthority`, `ward` and `constituency`.
    Every result states its selection policy. A date no release fits, or one several releases of the
    same month fit equally, is reported in that geography's result as `no-release-for-date` or
    `ambiguous-release` rather than failing the whole lookup.

    Points on an exterior or hole ring are included and labelled `boundary`, so a point on a shared
    border returns every area sharing it. A result with no match is `outside-coverage` when the point's
    country is outside the release's coverage, or outside every UK country boundary, and `no-match` when
    the release covers the point's country but no area of it contains the point. The country comes from
    a matched area's code where one has it, and otherwise from the country boundaries, and
    `country.determinedBy` says which.

    Every result states how far its answer can be trusted. `positionalToleranceM` adds the coordinate's
    uncertainty, taken from `accuracy` or else from its written decimal places, the boundary's
    generalisation, read from the ONS release name, and the stated accuracy of any transformation from
    the source CRS to WGS 84. A match whose edge lies within that tolerance is `nearBoundary`. The
    geometry's source file, hash, CRS and transformation are given for each release and each match.

    Each release is read into memory on first use, which can take a second or more for a large release;
    later lookups against it are fast.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindContainingAreasCrs | Unset):  Default: FindContainingAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        postcode (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PointContainmentEnvelope | Problem]
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
        postcode=postcode,
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
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindContainingAreasCrs | Unset = FindContainingAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> PointContainmentEnvelope | Problem | None:
    """Find the areas containing a point in one or more geographies

     Tests a point against one boundary release of each requested geography, at most four in one request,
    and says for each what contains it or why nothing does.

    Supply WGS 84 `lng` (also accepted as `lon` or `longitude`) and `lat` (the default), or set
    `crs=EPSG:27700` and supply British National Grid `easting` and `northing` or an Ordnance Survey
    `gridref` such as `TQ 30000 80000`. Set `crs=EPSG:29902` for Irish Grid metres. Or give a unit
    `postcode` instead of a coordinate: it is placed by its ONS Postcode Directory centroid, with the
    directory's own stated accuracy, exactly as `/postcodes/{postcode}` places it, and the answer names
    the postcode. A grid reference denotes a square, so its answer uses the cell centre and includes its
    whole half-diagonal as uncertainty. Every answer is normalised to WGS 84 and retains the input
    coordinate and named transformation.

    Each geography's release is either pinned, as `release={geography}/{release}`, chosen for `date` as
    the latest one dated on or before it, or defaults to the newest unambiguous published release. With
    neither `geography` nor `release`, the lookup covers `localAuthority`, `ward` and `constituency`.
    Every result states its selection policy. A date no release fits, or one several releases of the
    same month fit equally, is reported in that geography's result as `no-release-for-date` or
    `ambiguous-release` rather than failing the whole lookup.

    Points on an exterior or hole ring are included and labelled `boundary`, so a point on a shared
    border returns every area sharing it. A result with no match is `outside-coverage` when the point's
    country is outside the release's coverage, or outside every UK country boundary, and `no-match` when
    the release covers the point's country but no area of it contains the point. The country comes from
    a matched area's code where one has it, and otherwise from the country boundaries, and
    `country.determinedBy` says which.

    Every result states how far its answer can be trusted. `positionalToleranceM` adds the coordinate's
    uncertainty, taken from `accuracy` or else from its written decimal places, the boundary's
    generalisation, read from the ONS release name, and the stated accuracy of any transformation from
    the source CRS to WGS 84. A match whose edge lies within that tolerance is `nearBoundary`. The
    geometry's source file, hash, CRS and transformation are given for each release and each match.

    Each release is read into memory on first use, which can take a second or more for a large release;
    later lookups against it are fast.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindContainingAreasCrs | Unset):  Default: FindContainingAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        postcode (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PointContainmentEnvelope | Problem
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
        postcode=postcode,
        geography=geography,
        release=release,
        date=date,
        accuracy=accuracy,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindContainingAreasCrs | Unset = FindContainingAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> Response[PointContainmentEnvelope | Problem]:
    """Find the areas containing a point in one or more geographies

     Tests a point against one boundary release of each requested geography, at most four in one request,
    and says for each what contains it or why nothing does.

    Supply WGS 84 `lng` (also accepted as `lon` or `longitude`) and `lat` (the default), or set
    `crs=EPSG:27700` and supply British National Grid `easting` and `northing` or an Ordnance Survey
    `gridref` such as `TQ 30000 80000`. Set `crs=EPSG:29902` for Irish Grid metres. Or give a unit
    `postcode` instead of a coordinate: it is placed by its ONS Postcode Directory centroid, with the
    directory's own stated accuracy, exactly as `/postcodes/{postcode}` places it, and the answer names
    the postcode. A grid reference denotes a square, so its answer uses the cell centre and includes its
    whole half-diagonal as uncertainty. Every answer is normalised to WGS 84 and retains the input
    coordinate and named transformation.

    Each geography's release is either pinned, as `release={geography}/{release}`, chosen for `date` as
    the latest one dated on or before it, or defaults to the newest unambiguous published release. With
    neither `geography` nor `release`, the lookup covers `localAuthority`, `ward` and `constituency`.
    Every result states its selection policy. A date no release fits, or one several releases of the
    same month fit equally, is reported in that geography's result as `no-release-for-date` or
    `ambiguous-release` rather than failing the whole lookup.

    Points on an exterior or hole ring are included and labelled `boundary`, so a point on a shared
    border returns every area sharing it. A result with no match is `outside-coverage` when the point's
    country is outside the release's coverage, or outside every UK country boundary, and `no-match` when
    the release covers the point's country but no area of it contains the point. The country comes from
    a matched area's code where one has it, and otherwise from the country boundaries, and
    `country.determinedBy` says which.

    Every result states how far its answer can be trusted. `positionalToleranceM` adds the coordinate's
    uncertainty, taken from `accuracy` or else from its written decimal places, the boundary's
    generalisation, read from the ONS release name, and the stated accuracy of any transformation from
    the source CRS to WGS 84. A match whose edge lies within that tolerance is `nearBoundary`. The
    geometry's source file, hash, CRS and transformation are given for each release and each match.

    Each release is read into memory on first use, which can take a second or more for a large release;
    later lookups against it are fast.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindContainingAreasCrs | Unset):  Default: FindContainingAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        postcode (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PointContainmentEnvelope | Problem]
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
        postcode=postcode,
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
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: FindContainingAreasCrs | Unset = FindContainingAreasCrs.EPSG4326,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> PointContainmentEnvelope | Problem | None:
    """Find the areas containing a point in one or more geographies

     Tests a point against one boundary release of each requested geography, at most four in one request,
    and says for each what contains it or why nothing does.

    Supply WGS 84 `lng` (also accepted as `lon` or `longitude`) and `lat` (the default), or set
    `crs=EPSG:27700` and supply British National Grid `easting` and `northing` or an Ordnance Survey
    `gridref` such as `TQ 30000 80000`. Set `crs=EPSG:29902` for Irish Grid metres. Or give a unit
    `postcode` instead of a coordinate: it is placed by its ONS Postcode Directory centroid, with the
    directory's own stated accuracy, exactly as `/postcodes/{postcode}` places it, and the answer names
    the postcode. A grid reference denotes a square, so its answer uses the cell centre and includes its
    whole half-diagonal as uncertainty. Every answer is normalised to WGS 84 and retains the input
    coordinate and named transformation.

    Each geography's release is either pinned, as `release={geography}/{release}`, chosen for `date` as
    the latest one dated on or before it, or defaults to the newest unambiguous published release. With
    neither `geography` nor `release`, the lookup covers `localAuthority`, `ward` and `constituency`.
    Every result states its selection policy. A date no release fits, or one several releases of the
    same month fit equally, is reported in that geography's result as `no-release-for-date` or
    `ambiguous-release` rather than failing the whole lookup.

    Points on an exterior or hole ring are included and labelled `boundary`, so a point on a shared
    border returns every area sharing it. A result with no match is `outside-coverage` when the point's
    country is outside the release's coverage, or outside every UK country boundary, and `no-match` when
    the release covers the point's country but no area of it contains the point. The country comes from
    a matched area's code where one has it, and otherwise from the country boundaries, and
    `country.determinedBy` says which.

    Every result states how far its answer can be trusted. `positionalToleranceM` adds the coordinate's
    uncertainty, taken from `accuracy` or else from its written decimal places, the boundary's
    generalisation, read from the ONS release name, and the stated accuracy of any transformation from
    the source CRS to WGS 84. A match whose edge lies within that tolerance is `nearBoundary`. The
    geometry's source file, hash, CRS and transformation are given for each release and each match.

    Each release is read into memory on first use, which can take a second or more for a large release;
    later lookups against it are fast.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (FindContainingAreasCrs | Unset):  Default: FindContainingAreasCrs.EPSG4326.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        postcode (str | Unset):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PointContainmentEnvelope | Problem
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
            postcode=postcode,
            geography=geography,
            release=release,
            date=date,
            accuracy=accuracy,
        )
    ).parsed
