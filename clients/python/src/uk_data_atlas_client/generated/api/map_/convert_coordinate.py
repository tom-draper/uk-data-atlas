from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.convert_coordinate_crs import ConvertCoordinateCrs
from ...models.convert_coordinate_to import ConvertCoordinateTo
from ...models.coordinate_conversion_envelope import CoordinateConversionEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: ConvertCoordinateCrs | Unset = ConvertCoordinateCrs.EPSG4326,
    to: ConvertCoordinateTo | Unset = ConvertCoordinateTo.EPSG4326,
    gridref_digits: int | Unset = 5,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
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

    json_to: str | Unset = UNSET
    if not isinstance(to, Unset):
        json_to = to.value

    params["to"] = json_to

    params["gridrefDigits"] = gridref_digits

    params["easting"] = easting

    params["northing"] = northing

    params["gridref"] = gridref

    params["accuracy"] = accuracy

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/coordinates:convert",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CoordinateConversionEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = CoordinateConversionEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[CoordinateConversionEnvelope | Problem]:
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
    crs: ConvertCoordinateCrs | Unset = ConvertCoordinateCrs.EPSG4326,
    to: ConvertCoordinateTo | Unset = ConvertCoordinateTo.EPSG4326,
    gridref_digits: int | Unset = 5,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> Response[CoordinateConversionEnvelope | Problem]:
    """Convert one supported coordinate between WGS 84 and national grids

     Converts one horizontal coordinate without reading a boundary release. Its `point` is always
    normalised to WGS 84. By default that is the full response; select `to=EPSG:27700` or
    `to=EPSG:29902` to also receive a British National Grid or Irish Grid coordinate. Supply default WGS
    84 `lng` and `lat`, British National Grid `easting` and `northing` or an Ordnance Survey `gridref`
    with `crs=EPSG:27700`, or Irish Grid `easting` and `northing` with `crs=EPSG:29902`.

    The answer keeps the input form and named transformation. An Ordnance Survey grid reference denotes
    a square, not a point: the coordinate is the cell centre and uncertainty includes the square's half-
    diagonal. A British National Grid target also supplies its containing National Grid cell when one
    can represent the coordinate without overstating uncertainty; `gridrefDigits` can request a coarser
    cell. This route only converts horizontal position; it neither determines altitude nor implies an
    administrative-area relationship.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (ConvertCoordinateCrs | Unset):  Default: ConvertCoordinateCrs.EPSG4326.
        to (ConvertCoordinateTo | Unset):  Default: ConvertCoordinateTo.EPSG4326.
        gridref_digits (int | Unset):  Default: 5.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CoordinateConversionEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        lng=lng,
        lon=lon,
        longitude=longitude,
        lat=lat,
        crs=crs,
        to=to,
        gridref_digits=gridref_digits,
        easting=easting,
        northing=northing,
        gridref=gridref,
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
    crs: ConvertCoordinateCrs | Unset = ConvertCoordinateCrs.EPSG4326,
    to: ConvertCoordinateTo | Unset = ConvertCoordinateTo.EPSG4326,
    gridref_digits: int | Unset = 5,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> CoordinateConversionEnvelope | Problem | None:
    """Convert one supported coordinate between WGS 84 and national grids

     Converts one horizontal coordinate without reading a boundary release. Its `point` is always
    normalised to WGS 84. By default that is the full response; select `to=EPSG:27700` or
    `to=EPSG:29902` to also receive a British National Grid or Irish Grid coordinate. Supply default WGS
    84 `lng` and `lat`, British National Grid `easting` and `northing` or an Ordnance Survey `gridref`
    with `crs=EPSG:27700`, or Irish Grid `easting` and `northing` with `crs=EPSG:29902`.

    The answer keeps the input form and named transformation. An Ordnance Survey grid reference denotes
    a square, not a point: the coordinate is the cell centre and uncertainty includes the square's half-
    diagonal. A British National Grid target also supplies its containing National Grid cell when one
    can represent the coordinate without overstating uncertainty; `gridrefDigits` can request a coarser
    cell. This route only converts horizontal position; it neither determines altitude nor implies an
    administrative-area relationship.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (ConvertCoordinateCrs | Unset):  Default: ConvertCoordinateCrs.EPSG4326.
        to (ConvertCoordinateTo | Unset):  Default: ConvertCoordinateTo.EPSG4326.
        gridref_digits (int | Unset):  Default: 5.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CoordinateConversionEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        lng=lng,
        lon=lon,
        longitude=longitude,
        lat=lat,
        crs=crs,
        to=to,
        gridref_digits=gridref_digits,
        easting=easting,
        northing=northing,
        gridref=gridref,
        accuracy=accuracy,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    lng: str | Unset = UNSET,
    lon: str | Unset = UNSET,
    longitude: str | Unset = UNSET,
    lat: str | Unset = UNSET,
    crs: ConvertCoordinateCrs | Unset = ConvertCoordinateCrs.EPSG4326,
    to: ConvertCoordinateTo | Unset = ConvertCoordinateTo.EPSG4326,
    gridref_digits: int | Unset = 5,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> Response[CoordinateConversionEnvelope | Problem]:
    """Convert one supported coordinate between WGS 84 and national grids

     Converts one horizontal coordinate without reading a boundary release. Its `point` is always
    normalised to WGS 84. By default that is the full response; select `to=EPSG:27700` or
    `to=EPSG:29902` to also receive a British National Grid or Irish Grid coordinate. Supply default WGS
    84 `lng` and `lat`, British National Grid `easting` and `northing` or an Ordnance Survey `gridref`
    with `crs=EPSG:27700`, or Irish Grid `easting` and `northing` with `crs=EPSG:29902`.

    The answer keeps the input form and named transformation. An Ordnance Survey grid reference denotes
    a square, not a point: the coordinate is the cell centre and uncertainty includes the square's half-
    diagonal. A British National Grid target also supplies its containing National Grid cell when one
    can represent the coordinate without overstating uncertainty; `gridrefDigits` can request a coarser
    cell. This route only converts horizontal position; it neither determines altitude nor implies an
    administrative-area relationship.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (ConvertCoordinateCrs | Unset):  Default: ConvertCoordinateCrs.EPSG4326.
        to (ConvertCoordinateTo | Unset):  Default: ConvertCoordinateTo.EPSG4326.
        gridref_digits (int | Unset):  Default: 5.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CoordinateConversionEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        lng=lng,
        lon=lon,
        longitude=longitude,
        lat=lat,
        crs=crs,
        to=to,
        gridref_digits=gridref_digits,
        easting=easting,
        northing=northing,
        gridref=gridref,
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
    crs: ConvertCoordinateCrs | Unset = ConvertCoordinateCrs.EPSG4326,
    to: ConvertCoordinateTo | Unset = ConvertCoordinateTo.EPSG4326,
    gridref_digits: int | Unset = 5,
    easting: str | Unset = UNSET,
    northing: str | Unset = UNSET,
    gridref: str | Unset = UNSET,
    accuracy: float | Unset = UNSET,
) -> CoordinateConversionEnvelope | Problem | None:
    """Convert one supported coordinate between WGS 84 and national grids

     Converts one horizontal coordinate without reading a boundary release. Its `point` is always
    normalised to WGS 84. By default that is the full response; select `to=EPSG:27700` or
    `to=EPSG:29902` to also receive a British National Grid or Irish Grid coordinate. Supply default WGS
    84 `lng` and `lat`, British National Grid `easting` and `northing` or an Ordnance Survey `gridref`
    with `crs=EPSG:27700`, or Irish Grid `easting` and `northing` with `crs=EPSG:29902`.

    The answer keeps the input form and named transformation. An Ordnance Survey grid reference denotes
    a square, not a point: the coordinate is the cell centre and uncertainty includes the square's half-
    diagonal. A British National Grid target also supplies its containing National Grid cell when one
    can represent the coordinate without overstating uncertainty; `gridrefDigits` can request a coarser
    cell. This route only converts horizontal position; it neither determines altitude nor implies an
    administrative-area relationship.

    Args:
        lng (str | Unset):
        lon (str | Unset):
        longitude (str | Unset):
        lat (str | Unset):
        crs (ConvertCoordinateCrs | Unset):  Default: ConvertCoordinateCrs.EPSG4326.
        to (ConvertCoordinateTo | Unset):  Default: ConvertCoordinateTo.EPSG4326.
        gridref_digits (int | Unset):  Default: 5.
        easting (str | Unset):
        northing (str | Unset):
        gridref (str | Unset):
        accuracy (float | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CoordinateConversionEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            lng=lng,
            lon=lon,
            longitude=longitude,
            lat=lat,
            crs=crs,
            to=to,
            gridref_digits=gridref_digits,
            easting=easting,
            northing=northing,
            gridref=gridref,
            accuracy=accuracy,
        )
    ).parsed
