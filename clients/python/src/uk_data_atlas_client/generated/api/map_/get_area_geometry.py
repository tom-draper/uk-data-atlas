from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_geometry_envelope import AreaGeometryEnvelope
from ...models.get_area_geometry_tier import GetAreaGeometryTier
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    tier: GetAreaGeometryTier | Unset = GetAreaGeometryTier.FULL,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_tier: str | Unset = UNSET
    if not isinstance(tier, Unset):
        json_tier = tier.value

    params["tier"] = json_tier

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/geometry".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaGeometryEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaGeometryEnvelope.from_dict(response.json())

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
) -> Response[AreaGeometryEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetAreaGeometryTier | Unset = GetAreaGeometryTier.FULL,
) -> Response[AreaGeometryEnvelope | Problem]:
    """Get one compiled area's raw geometry as a GeoJSON Feature

     Serves the area's own geometry from its raw, cached source GeoJSON, not a generalised or simplified
    derivative, always in WGS84. A source in British National Grid (EPSG:27700) is reprojected per area
    through EPSG:1314, OSGB36 to WGS 84 (6), a Helmert transformation EPSG states as accurate to 2 m in
    Great Britain; `properties.geometrySource` records the source CRS and any transformation applied.
    Northern Ireland areas in the releases that declare `northern-ireland-offset` are first moved by
    that correction, which the ONS's grid files need there, and `geometrySource.corrections` names it
    when applied. A code that maps to more than one feature fragment in the source (e.g. an area split
    across islands) is returned as a single GeometryCollection rather than picking one fragment.
    Coordinates keep seven decimal places of a degree, about a centimetre; most publishers' WGS84 files
    carry fifteen, which is float noise from their own reprojection. A few areas whose parts lie less
    than a centimetre apart keep their source precision, because rounding would make their valid
    boundary invalid.

    `tier` generalises the geometry before it is served, for callers that do not need every vertex:
    Highland is 45,124 of them. A tier is the side of the smallest square of detail kept, and the rule
    is Visvalingam-Whyatt, dropping the vertex whose triangle with its neighbours is smallest until none
    below the tier's threshold remains. Triangles are measured in the EPSG:6933 equal-area projection,
    so a tier means the same thing anywhere in the country. A part or hole smaller than the threshold is
    dropped whole rather than left as a triangle, and `properties.generalisation` reports the vertex and
    part counts both before and after.

    A tier bounds the size of feature dropped; it does not promise that no vertex moves further than its
    tolerance, since the same deviation spans a larger triangle the further apart its neighbours lie.
    Each area is generalised on its own, so above `full` two neighbours drawn together may disagree
    along the border they share. Ask for `full` where borders must meet exactly. This is still per-
    request simplification, not the vector tiles the full proposal describes.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaGeometryTier | Unset):  Default: GetAreaGeometryTier.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaGeometryEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        tier=tier,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetAreaGeometryTier | Unset = GetAreaGeometryTier.FULL,
) -> AreaGeometryEnvelope | Problem | None:
    """Get one compiled area's raw geometry as a GeoJSON Feature

     Serves the area's own geometry from its raw, cached source GeoJSON, not a generalised or simplified
    derivative, always in WGS84. A source in British National Grid (EPSG:27700) is reprojected per area
    through EPSG:1314, OSGB36 to WGS 84 (6), a Helmert transformation EPSG states as accurate to 2 m in
    Great Britain; `properties.geometrySource` records the source CRS and any transformation applied.
    Northern Ireland areas in the releases that declare `northern-ireland-offset` are first moved by
    that correction, which the ONS's grid files need there, and `geometrySource.corrections` names it
    when applied. A code that maps to more than one feature fragment in the source (e.g. an area split
    across islands) is returned as a single GeometryCollection rather than picking one fragment.
    Coordinates keep seven decimal places of a degree, about a centimetre; most publishers' WGS84 files
    carry fifteen, which is float noise from their own reprojection. A few areas whose parts lie less
    than a centimetre apart keep their source precision, because rounding would make their valid
    boundary invalid.

    `tier` generalises the geometry before it is served, for callers that do not need every vertex:
    Highland is 45,124 of them. A tier is the side of the smallest square of detail kept, and the rule
    is Visvalingam-Whyatt, dropping the vertex whose triangle with its neighbours is smallest until none
    below the tier's threshold remains. Triangles are measured in the EPSG:6933 equal-area projection,
    so a tier means the same thing anywhere in the country. A part or hole smaller than the threshold is
    dropped whole rather than left as a triangle, and `properties.generalisation` reports the vertex and
    part counts both before and after.

    A tier bounds the size of feature dropped; it does not promise that no vertex moves further than its
    tolerance, since the same deviation spans a larger triangle the further apart its neighbours lie.
    Each area is generalised on its own, so above `full` two neighbours drawn together may disagree
    along the border they share. Ask for `full` where borders must meet exactly. This is still per-
    request simplification, not the vector tiles the full proposal describes.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaGeometryTier | Unset):  Default: GetAreaGeometryTier.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaGeometryEnvelope | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        tier=tier,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetAreaGeometryTier | Unset = GetAreaGeometryTier.FULL,
) -> Response[AreaGeometryEnvelope | Problem]:
    """Get one compiled area's raw geometry as a GeoJSON Feature

     Serves the area's own geometry from its raw, cached source GeoJSON, not a generalised or simplified
    derivative, always in WGS84. A source in British National Grid (EPSG:27700) is reprojected per area
    through EPSG:1314, OSGB36 to WGS 84 (6), a Helmert transformation EPSG states as accurate to 2 m in
    Great Britain; `properties.geometrySource` records the source CRS and any transformation applied.
    Northern Ireland areas in the releases that declare `northern-ireland-offset` are first moved by
    that correction, which the ONS's grid files need there, and `geometrySource.corrections` names it
    when applied. A code that maps to more than one feature fragment in the source (e.g. an area split
    across islands) is returned as a single GeometryCollection rather than picking one fragment.
    Coordinates keep seven decimal places of a degree, about a centimetre; most publishers' WGS84 files
    carry fifteen, which is float noise from their own reprojection. A few areas whose parts lie less
    than a centimetre apart keep their source precision, because rounding would make their valid
    boundary invalid.

    `tier` generalises the geometry before it is served, for callers that do not need every vertex:
    Highland is 45,124 of them. A tier is the side of the smallest square of detail kept, and the rule
    is Visvalingam-Whyatt, dropping the vertex whose triangle with its neighbours is smallest until none
    below the tier's threshold remains. Triangles are measured in the EPSG:6933 equal-area projection,
    so a tier means the same thing anywhere in the country. A part or hole smaller than the threshold is
    dropped whole rather than left as a triangle, and `properties.generalisation` reports the vertex and
    part counts both before and after.

    A tier bounds the size of feature dropped; it does not promise that no vertex moves further than its
    tolerance, since the same deviation spans a larger triangle the further apart its neighbours lie.
    Each area is generalised on its own, so above `full` two neighbours drawn together may disagree
    along the border they share. Ask for `full` where borders must meet exactly. This is still per-
    request simplification, not the vector tiles the full proposal describes.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaGeometryTier | Unset):  Default: GetAreaGeometryTier.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaGeometryEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        tier=tier,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetAreaGeometryTier | Unset = GetAreaGeometryTier.FULL,
) -> AreaGeometryEnvelope | Problem | None:
    """Get one compiled area's raw geometry as a GeoJSON Feature

     Serves the area's own geometry from its raw, cached source GeoJSON, not a generalised or simplified
    derivative, always in WGS84. A source in British National Grid (EPSG:27700) is reprojected per area
    through EPSG:1314, OSGB36 to WGS 84 (6), a Helmert transformation EPSG states as accurate to 2 m in
    Great Britain; `properties.geometrySource` records the source CRS and any transformation applied.
    Northern Ireland areas in the releases that declare `northern-ireland-offset` are first moved by
    that correction, which the ONS's grid files need there, and `geometrySource.corrections` names it
    when applied. A code that maps to more than one feature fragment in the source (e.g. an area split
    across islands) is returned as a single GeometryCollection rather than picking one fragment.
    Coordinates keep seven decimal places of a degree, about a centimetre; most publishers' WGS84 files
    carry fifteen, which is float noise from their own reprojection. A few areas whose parts lie less
    than a centimetre apart keep their source precision, because rounding would make their valid
    boundary invalid.

    `tier` generalises the geometry before it is served, for callers that do not need every vertex:
    Highland is 45,124 of them. A tier is the side of the smallest square of detail kept, and the rule
    is Visvalingam-Whyatt, dropping the vertex whose triangle with its neighbours is smallest until none
    below the tier's threshold remains. Triangles are measured in the EPSG:6933 equal-area projection,
    so a tier means the same thing anywhere in the country. A part or hole smaller than the threshold is
    dropped whole rather than left as a triangle, and `properties.generalisation` reports the vertex and
    part counts both before and after.

    A tier bounds the size of feature dropped; it does not promise that no vertex moves further than its
    tolerance, since the same deviation spans a larger triangle the further apart its neighbours lie.
    Each area is generalised on its own, so above `full` two neighbours drawn together may disagree
    along the border they share. Ask for `full` where borders must meet exactly. This is still per-
    request simplification, not the vector tiles the full proposal describes.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaGeometryTier | Unset):  Default: GetAreaGeometryTier.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaGeometryEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            tier=tier,
        )
    ).parsed
