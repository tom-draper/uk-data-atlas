from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_envelope import AreaEnvelope
from ...models.get_area_include_item import GetAreaIncludeItem
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    include: list[GetAreaIncludeItem] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_include: list[str] | Unset = UNSET
    if not isinstance(include, Unset):
        json_include = []
        for include_item_data in include:
            include_item = include_item_data.value
            json_include.append(include_item)

    params["include"] = json_include

    json_measure: list[str] | Unset = UNSET
    if not isinstance(measure, Unset):
        json_measure = measure

    params["measure"] = json_measure

    json_crosswalk: list[str] | Unset = UNSET
    if not isinstance(crosswalk, Unset):
        json_crosswalk = crosswalk

    params["crosswalk"] = json_crosswalk

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 422:
        response_422 = Problem.from_dict(response.json())

        return response_422

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[AreaEnvelope | Problem]:
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
    include: list[GetAreaIncludeItem] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> Response[AreaEnvelope | Problem]:
    """Get one compiled area by its full identity

     Where precompiled postcode placements cover this boundary release, the area also includes live and
    terminated unit-postcode counts from the ONS Postcode Directory edition shown in
    `postcodes.edition`.

    `include` expands the area with any of four reports, each under its own key:

    `capabilities` reports geometry, published relationship and crosswalk edges, direct-code named-
    location membership, and every measure's capability for this exact area, each in the capability
    vocabulary described by `CapabilityStatus`: `available`, `partial`, `requires-conversion`,
    `unsupported` or `not-built`, with a `reason` on every status but `available`. A measure is
    `available` when a source partition published on this release has a value for the area in every
    period, and `partial` when it has one in only some periods or its codes only partly join the
    release. It `requires-conversion` when no partition is published on the release but a published
    crosswalk converts one onto it: each entry in `conversions` names the crosswalk, the source
    partition and period, and a ready `href` to the convert route. A conversion is only offered after
    that exact conversion has been run on the source's latest period and accepted, and only if it
    reaches this area. A measure whose values do not add over areas is never offered a conversion.
    `capabilities.data.measures` lists the available, partial and convertible measures;
    `capabilities.data.counts` counts every measure by status, the unsupported ones included.
    Compatibility is based on area-code membership only and does not assert equal geometry.

    `citation` returns what a caller needs to cite the area as served by this Atlas release: the
    immutable Atlas release, the content hash of the area identity artifact, the boundary release's
    publisher, licence and metadata hash, geometry provenance, the validation results for the release
    and any cited crosswalk, and an attribution block. Name a `measure` to cite the observation
    artifacts, with their content hashes, that hold a value for this area in a source partition assessed
    against this exact boundary release. Only those partitions' datasets are attributed, together with
    any dataset a derived measure is calculated from. Name a `crosswalk` to cite one that publishes a
    relationship for this area. A resource that supplies nothing for the area is refused with `422`
    rather than cited. The citation hashes the whole geometry source file; `include=metrics` supplies
    the per-area `geometryHash`. The boundary release's `metadataHash` pins its metadata, which names
    the source file but does not hash its contents. The envelope's top-level `atlasRelease` is the
    release of the API response itself: use `citation.identity.contentHash` for the compiled area
    identity, `citation.boundary.metadataHash` for the boundary metadata, and the hashes under
    `citation.measures`, `citation.crosswalks` and `citation.geometry` for the other artifacts that
    support a cited result.

    `metrics` measures the area's geometry without transferring its coordinates: its bounding box,
    centroid, label point, area and perimeter. The same source, reprojection and declared grid
    corrections apply as for the geometry itself, and `metrics.geometrySource` records them. Area is
    ellipsoidal, taken through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical
    equal-area projection on the WGS 84 ellipsoid, so projected area is area on the ellipsoid and no
    correction is applied; holes are subtracted. Perimeter sums every ring, holes included, each edge's
    ground length coming from the ellipsoid's radii of curvature at its mid-latitude. The centroid is
    the centre of area in that same projection, inverted back to WGS 84. `labelPoint` is guaranteed to
    lie inside the geometry: the centroid where that falls within the area, otherwise the midpoint of
    the widest run of interior found on latitudes sampled across the bounding box; `labelPointMethod`
    says which was used. These figures describe the boundary as that release publishes it, at its own
    generalisation. They are not a published land-area statistic: a coastline-clipped boundary still
    encloses inland water, so they differ from the ONS Standard Area Measurement that `population-
    density` uses as its denominator. The `method` block repeats this with every response. An area whose
    geometry carries no polygon to measure, such as a release held only as points, is refused with `422`
    rather than measured as zero. `geometrySource.validity` carries the build-time validity report for
    the full WGS84 geometry. Invalid geometry is not repaired; measurements from it may be unreliable.
    An unmeasurable geometry's `422` response also carries `geometrySource` and its report. If
    measurement throws after geometry is loaded, the `503` problem retains that provenance and report
    too.

    Args:
        geography (str):
        release (str):
        code (str):
        include (list[GetAreaIncludeItem] | Unset):
        measure (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        include=include,
        measure=measure,
        crosswalk=crosswalk,
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
    include: list[GetAreaIncludeItem] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> AreaEnvelope | Problem | None:
    """Get one compiled area by its full identity

     Where precompiled postcode placements cover this boundary release, the area also includes live and
    terminated unit-postcode counts from the ONS Postcode Directory edition shown in
    `postcodes.edition`.

    `include` expands the area with any of four reports, each under its own key:

    `capabilities` reports geometry, published relationship and crosswalk edges, direct-code named-
    location membership, and every measure's capability for this exact area, each in the capability
    vocabulary described by `CapabilityStatus`: `available`, `partial`, `requires-conversion`,
    `unsupported` or `not-built`, with a `reason` on every status but `available`. A measure is
    `available` when a source partition published on this release has a value for the area in every
    period, and `partial` when it has one in only some periods or its codes only partly join the
    release. It `requires-conversion` when no partition is published on the release but a published
    crosswalk converts one onto it: each entry in `conversions` names the crosswalk, the source
    partition and period, and a ready `href` to the convert route. A conversion is only offered after
    that exact conversion has been run on the source's latest period and accepted, and only if it
    reaches this area. A measure whose values do not add over areas is never offered a conversion.
    `capabilities.data.measures` lists the available, partial and convertible measures;
    `capabilities.data.counts` counts every measure by status, the unsupported ones included.
    Compatibility is based on area-code membership only and does not assert equal geometry.

    `citation` returns what a caller needs to cite the area as served by this Atlas release: the
    immutable Atlas release, the content hash of the area identity artifact, the boundary release's
    publisher, licence and metadata hash, geometry provenance, the validation results for the release
    and any cited crosswalk, and an attribution block. Name a `measure` to cite the observation
    artifacts, with their content hashes, that hold a value for this area in a source partition assessed
    against this exact boundary release. Only those partitions' datasets are attributed, together with
    any dataset a derived measure is calculated from. Name a `crosswalk` to cite one that publishes a
    relationship for this area. A resource that supplies nothing for the area is refused with `422`
    rather than cited. The citation hashes the whole geometry source file; `include=metrics` supplies
    the per-area `geometryHash`. The boundary release's `metadataHash` pins its metadata, which names
    the source file but does not hash its contents. The envelope's top-level `atlasRelease` is the
    release of the API response itself: use `citation.identity.contentHash` for the compiled area
    identity, `citation.boundary.metadataHash` for the boundary metadata, and the hashes under
    `citation.measures`, `citation.crosswalks` and `citation.geometry` for the other artifacts that
    support a cited result.

    `metrics` measures the area's geometry without transferring its coordinates: its bounding box,
    centroid, label point, area and perimeter. The same source, reprojection and declared grid
    corrections apply as for the geometry itself, and `metrics.geometrySource` records them. Area is
    ellipsoidal, taken through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical
    equal-area projection on the WGS 84 ellipsoid, so projected area is area on the ellipsoid and no
    correction is applied; holes are subtracted. Perimeter sums every ring, holes included, each edge's
    ground length coming from the ellipsoid's radii of curvature at its mid-latitude. The centroid is
    the centre of area in that same projection, inverted back to WGS 84. `labelPoint` is guaranteed to
    lie inside the geometry: the centroid where that falls within the area, otherwise the midpoint of
    the widest run of interior found on latitudes sampled across the bounding box; `labelPointMethod`
    says which was used. These figures describe the boundary as that release publishes it, at its own
    generalisation. They are not a published land-area statistic: a coastline-clipped boundary still
    encloses inland water, so they differ from the ONS Standard Area Measurement that `population-
    density` uses as its denominator. The `method` block repeats this with every response. An area whose
    geometry carries no polygon to measure, such as a release held only as points, is refused with `422`
    rather than measured as zero. `geometrySource.validity` carries the build-time validity report for
    the full WGS84 geometry. Invalid geometry is not repaired; measurements from it may be unreliable.
    An unmeasurable geometry's `422` response also carries `geometrySource` and its report. If
    measurement throws after geometry is loaded, the `503` problem retains that provenance and report
    too.

    Args:
        geography (str):
        release (str):
        code (str):
        include (list[GetAreaIncludeItem] | Unset):
        measure (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaEnvelope | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        include=include,
        measure=measure,
        crosswalk=crosswalk,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    include: list[GetAreaIncludeItem] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> Response[AreaEnvelope | Problem]:
    """Get one compiled area by its full identity

     Where precompiled postcode placements cover this boundary release, the area also includes live and
    terminated unit-postcode counts from the ONS Postcode Directory edition shown in
    `postcodes.edition`.

    `include` expands the area with any of four reports, each under its own key:

    `capabilities` reports geometry, published relationship and crosswalk edges, direct-code named-
    location membership, and every measure's capability for this exact area, each in the capability
    vocabulary described by `CapabilityStatus`: `available`, `partial`, `requires-conversion`,
    `unsupported` or `not-built`, with a `reason` on every status but `available`. A measure is
    `available` when a source partition published on this release has a value for the area in every
    period, and `partial` when it has one in only some periods or its codes only partly join the
    release. It `requires-conversion` when no partition is published on the release but a published
    crosswalk converts one onto it: each entry in `conversions` names the crosswalk, the source
    partition and period, and a ready `href` to the convert route. A conversion is only offered after
    that exact conversion has been run on the source's latest period and accepted, and only if it
    reaches this area. A measure whose values do not add over areas is never offered a conversion.
    `capabilities.data.measures` lists the available, partial and convertible measures;
    `capabilities.data.counts` counts every measure by status, the unsupported ones included.
    Compatibility is based on area-code membership only and does not assert equal geometry.

    `citation` returns what a caller needs to cite the area as served by this Atlas release: the
    immutable Atlas release, the content hash of the area identity artifact, the boundary release's
    publisher, licence and metadata hash, geometry provenance, the validation results for the release
    and any cited crosswalk, and an attribution block. Name a `measure` to cite the observation
    artifacts, with their content hashes, that hold a value for this area in a source partition assessed
    against this exact boundary release. Only those partitions' datasets are attributed, together with
    any dataset a derived measure is calculated from. Name a `crosswalk` to cite one that publishes a
    relationship for this area. A resource that supplies nothing for the area is refused with `422`
    rather than cited. The citation hashes the whole geometry source file; `include=metrics` supplies
    the per-area `geometryHash`. The boundary release's `metadataHash` pins its metadata, which names
    the source file but does not hash its contents. The envelope's top-level `atlasRelease` is the
    release of the API response itself: use `citation.identity.contentHash` for the compiled area
    identity, `citation.boundary.metadataHash` for the boundary metadata, and the hashes under
    `citation.measures`, `citation.crosswalks` and `citation.geometry` for the other artifacts that
    support a cited result.

    `metrics` measures the area's geometry without transferring its coordinates: its bounding box,
    centroid, label point, area and perimeter. The same source, reprojection and declared grid
    corrections apply as for the geometry itself, and `metrics.geometrySource` records them. Area is
    ellipsoidal, taken through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical
    equal-area projection on the WGS 84 ellipsoid, so projected area is area on the ellipsoid and no
    correction is applied; holes are subtracted. Perimeter sums every ring, holes included, each edge's
    ground length coming from the ellipsoid's radii of curvature at its mid-latitude. The centroid is
    the centre of area in that same projection, inverted back to WGS 84. `labelPoint` is guaranteed to
    lie inside the geometry: the centroid where that falls within the area, otherwise the midpoint of
    the widest run of interior found on latitudes sampled across the bounding box; `labelPointMethod`
    says which was used. These figures describe the boundary as that release publishes it, at its own
    generalisation. They are not a published land-area statistic: a coastline-clipped boundary still
    encloses inland water, so they differ from the ONS Standard Area Measurement that `population-
    density` uses as its denominator. The `method` block repeats this with every response. An area whose
    geometry carries no polygon to measure, such as a release held only as points, is refused with `422`
    rather than measured as zero. `geometrySource.validity` carries the build-time validity report for
    the full WGS84 geometry. Invalid geometry is not repaired; measurements from it may be unreliable.
    An unmeasurable geometry's `422` response also carries `geometrySource` and its report. If
    measurement throws after geometry is loaded, the `503` problem retains that provenance and report
    too.

    Args:
        geography (str):
        release (str):
        code (str):
        include (list[GetAreaIncludeItem] | Unset):
        measure (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        include=include,
        measure=measure,
        crosswalk=crosswalk,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    include: list[GetAreaIncludeItem] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> AreaEnvelope | Problem | None:
    """Get one compiled area by its full identity

     Where precompiled postcode placements cover this boundary release, the area also includes live and
    terminated unit-postcode counts from the ONS Postcode Directory edition shown in
    `postcodes.edition`.

    `include` expands the area with any of four reports, each under its own key:

    `capabilities` reports geometry, published relationship and crosswalk edges, direct-code named-
    location membership, and every measure's capability for this exact area, each in the capability
    vocabulary described by `CapabilityStatus`: `available`, `partial`, `requires-conversion`,
    `unsupported` or `not-built`, with a `reason` on every status but `available`. A measure is
    `available` when a source partition published on this release has a value for the area in every
    period, and `partial` when it has one in only some periods or its codes only partly join the
    release. It `requires-conversion` when no partition is published on the release but a published
    crosswalk converts one onto it: each entry in `conversions` names the crosswalk, the source
    partition and period, and a ready `href` to the convert route. A conversion is only offered after
    that exact conversion has been run on the source's latest period and accepted, and only if it
    reaches this area. A measure whose values do not add over areas is never offered a conversion.
    `capabilities.data.measures` lists the available, partial and convertible measures;
    `capabilities.data.counts` counts every measure by status, the unsupported ones included.
    Compatibility is based on area-code membership only and does not assert equal geometry.

    `citation` returns what a caller needs to cite the area as served by this Atlas release: the
    immutable Atlas release, the content hash of the area identity artifact, the boundary release's
    publisher, licence and metadata hash, geometry provenance, the validation results for the release
    and any cited crosswalk, and an attribution block. Name a `measure` to cite the observation
    artifacts, with their content hashes, that hold a value for this area in a source partition assessed
    against this exact boundary release. Only those partitions' datasets are attributed, together with
    any dataset a derived measure is calculated from. Name a `crosswalk` to cite one that publishes a
    relationship for this area. A resource that supplies nothing for the area is refused with `422`
    rather than cited. The citation hashes the whole geometry source file; `include=metrics` supplies
    the per-area `geometryHash`. The boundary release's `metadataHash` pins its metadata, which names
    the source file but does not hash its contents. The envelope's top-level `atlasRelease` is the
    release of the API response itself: use `citation.identity.contentHash` for the compiled area
    identity, `citation.boundary.metadataHash` for the boundary metadata, and the hashes under
    `citation.measures`, `citation.crosswalks` and `citation.geometry` for the other artifacts that
    support a cited result.

    `metrics` measures the area's geometry without transferring its coordinates: its bounding box,
    centroid, label point, area and perimeter. The same source, reprojection and declared grid
    corrections apply as for the geometry itself, and `metrics.geometrySource` records them. Area is
    ellipsoidal, taken through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical
    equal-area projection on the WGS 84 ellipsoid, so projected area is area on the ellipsoid and no
    correction is applied; holes are subtracted. Perimeter sums every ring, holes included, each edge's
    ground length coming from the ellipsoid's radii of curvature at its mid-latitude. The centroid is
    the centre of area in that same projection, inverted back to WGS 84. `labelPoint` is guaranteed to
    lie inside the geometry: the centroid where that falls within the area, otherwise the midpoint of
    the widest run of interior found on latitudes sampled across the bounding box; `labelPointMethod`
    says which was used. These figures describe the boundary as that release publishes it, at its own
    generalisation. They are not a published land-area statistic: a coastline-clipped boundary still
    encloses inland water, so they differ from the ONS Standard Area Measurement that `population-
    density` uses as its denominator. The `method` block repeats this with every response. An area whose
    geometry carries no polygon to measure, such as a release held only as points, is refused with `422`
    rather than measured as zero. `geometrySource.validity` carries the build-time validity report for
    the full WGS84 geometry. Invalid geometry is not repaired; measurements from it may be unreliable.
    An unmeasurable geometry's `422` response also carries `geometrySource` and its report. If
    measurement throws after geometry is loaded, the `503` problem retains that provenance and report
    too.

    Args:
        geography (str):
        release (str):
        code (str):
        include (list[GetAreaIncludeItem] | Unset):
        measure (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            include=include,
            measure=measure,
            crosswalk=crosswalk,
        )
    ).parsed
