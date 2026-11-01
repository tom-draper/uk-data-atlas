from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_children_geometry_envelope import AreaChildrenGeometryEnvelope
from ...models.get_area_children_geometry_tier import GetAreaChildrenGeometryTier
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    tier: GetAreaChildrenGeometryTier | Unset = GetAreaChildrenGeometryTier.FULL,
    child_geography: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_tier: str | Unset = UNSET
    if not isinstance(tier, Unset):
        json_tier = tier.value

    params["tier"] = json_tier

    params["childGeography"] = child_geography

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/children/geometry".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaChildrenGeometryEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaChildrenGeometryEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = Problem.from_dict(response.json())

        return response_409

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
) -> Response[AreaChildrenGeometryEnvelope | Problem]:
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
    tier: GetAreaChildrenGeometryTier | Unset = GetAreaChildrenGeometryTier.FULL,
    child_geography: str | Unset = UNSET,
) -> Response[AreaChildrenGeometryEnvelope | Problem]:
    """Get every child of an area as one GeoJSON FeatureCollection

     Returns the geometry of every area a published crosswalk names as contained by this one, as a single
    FeatureCollection: all the wards in a local authority in one request rather than one request each.
    Each feature carries its own identity, the crosswalk that places it in the collection, and its
    geometry provenance.

    Membership is a published crosswalk's claim, not a geometric test run at request time, so this
    returns what the Atlas has published rather than what a point-in-polygon sweep would find. An area
    with no published containment relationship is a 404, not an empty collection.

    `tier` generalises every member, exactly as on the geometry route, and is the reason this endpoint
    is usable at all for a large authority. The method is reported once for the collection rather than
    on each member; each member reports only what the tier cost it, so one that lost an island can be
    told from one that did not. Note the caveat that travels with it: members are generalised one at a
    time, so above `full` neighbours in the same collection may disagree along a shared border.

    A member that is published as a relationship but has no servable geometry is listed in
    `withoutGeometry` with the reason, rather than being passed over. `collection.members` and
    `collection.withGeometry` disagreeing is how a caller tells a partial collection from a complete
    one; the response is still a 200. At most 1,000 children may be requested in one collection.
    Geometry collections process at most 250,000 source vertices per request, counted before
    simplification. A larger request returns 422 without a partial collection. Reduce the page size for
    a box query, omit its tier to retrieve identities, or follow the problem's `links.downloads` to the
    boundary release metadata and its whole-release downloads.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaChildrenGeometryTier | Unset):  Default: GetAreaChildrenGeometryTier.FULL.
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaChildrenGeometryEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        tier=tier,
        child_geography=child_geography,
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
    tier: GetAreaChildrenGeometryTier | Unset = GetAreaChildrenGeometryTier.FULL,
    child_geography: str | Unset = UNSET,
) -> AreaChildrenGeometryEnvelope | Problem | None:
    """Get every child of an area as one GeoJSON FeatureCollection

     Returns the geometry of every area a published crosswalk names as contained by this one, as a single
    FeatureCollection: all the wards in a local authority in one request rather than one request each.
    Each feature carries its own identity, the crosswalk that places it in the collection, and its
    geometry provenance.

    Membership is a published crosswalk's claim, not a geometric test run at request time, so this
    returns what the Atlas has published rather than what a point-in-polygon sweep would find. An area
    with no published containment relationship is a 404, not an empty collection.

    `tier` generalises every member, exactly as on the geometry route, and is the reason this endpoint
    is usable at all for a large authority. The method is reported once for the collection rather than
    on each member; each member reports only what the tier cost it, so one that lost an island can be
    told from one that did not. Note the caveat that travels with it: members are generalised one at a
    time, so above `full` neighbours in the same collection may disagree along a shared border.

    A member that is published as a relationship but has no servable geometry is listed in
    `withoutGeometry` with the reason, rather than being passed over. `collection.members` and
    `collection.withGeometry` disagreeing is how a caller tells a partial collection from a complete
    one; the response is still a 200. At most 1,000 children may be requested in one collection.
    Geometry collections process at most 250,000 source vertices per request, counted before
    simplification. A larger request returns 422 without a partial collection. Reduce the page size for
    a box query, omit its tier to retrieve identities, or follow the problem's `links.downloads` to the
    boundary release metadata and its whole-release downloads.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaChildrenGeometryTier | Unset):  Default: GetAreaChildrenGeometryTier.FULL.
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaChildrenGeometryEnvelope | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        tier=tier,
        child_geography=child_geography,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetAreaChildrenGeometryTier | Unset = GetAreaChildrenGeometryTier.FULL,
    child_geography: str | Unset = UNSET,
) -> Response[AreaChildrenGeometryEnvelope | Problem]:
    """Get every child of an area as one GeoJSON FeatureCollection

     Returns the geometry of every area a published crosswalk names as contained by this one, as a single
    FeatureCollection: all the wards in a local authority in one request rather than one request each.
    Each feature carries its own identity, the crosswalk that places it in the collection, and its
    geometry provenance.

    Membership is a published crosswalk's claim, not a geometric test run at request time, so this
    returns what the Atlas has published rather than what a point-in-polygon sweep would find. An area
    with no published containment relationship is a 404, not an empty collection.

    `tier` generalises every member, exactly as on the geometry route, and is the reason this endpoint
    is usable at all for a large authority. The method is reported once for the collection rather than
    on each member; each member reports only what the tier cost it, so one that lost an island can be
    told from one that did not. Note the caveat that travels with it: members are generalised one at a
    time, so above `full` neighbours in the same collection may disagree along a shared border.

    A member that is published as a relationship but has no servable geometry is listed in
    `withoutGeometry` with the reason, rather than being passed over. `collection.members` and
    `collection.withGeometry` disagreeing is how a caller tells a partial collection from a complete
    one; the response is still a 200. At most 1,000 children may be requested in one collection.
    Geometry collections process at most 250,000 source vertices per request, counted before
    simplification. A larger request returns 422 without a partial collection. Reduce the page size for
    a box query, omit its tier to retrieve identities, or follow the problem's `links.downloads` to the
    boundary release metadata and its whole-release downloads.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaChildrenGeometryTier | Unset):  Default: GetAreaChildrenGeometryTier.FULL.
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaChildrenGeometryEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        tier=tier,
        child_geography=child_geography,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetAreaChildrenGeometryTier | Unset = GetAreaChildrenGeometryTier.FULL,
    child_geography: str | Unset = UNSET,
) -> AreaChildrenGeometryEnvelope | Problem | None:
    """Get every child of an area as one GeoJSON FeatureCollection

     Returns the geometry of every area a published crosswalk names as contained by this one, as a single
    FeatureCollection: all the wards in a local authority in one request rather than one request each.
    Each feature carries its own identity, the crosswalk that places it in the collection, and its
    geometry provenance.

    Membership is a published crosswalk's claim, not a geometric test run at request time, so this
    returns what the Atlas has published rather than what a point-in-polygon sweep would find. An area
    with no published containment relationship is a 404, not an empty collection.

    `tier` generalises every member, exactly as on the geometry route, and is the reason this endpoint
    is usable at all for a large authority. The method is reported once for the collection rather than
    on each member; each member reports only what the tier cost it, so one that lost an island can be
    told from one that did not. Note the caveat that travels with it: members are generalised one at a
    time, so above `full` neighbours in the same collection may disagree along a shared border.

    A member that is published as a relationship but has no servable geometry is listed in
    `withoutGeometry` with the reason, rather than being passed over. `collection.members` and
    `collection.withGeometry` disagreeing is how a caller tells a partial collection from a complete
    one; the response is still a 200. At most 1,000 children may be requested in one collection.
    Geometry collections process at most 250,000 source vertices per request, counted before
    simplification. A larger request returns 422 without a partial collection. Reduce the page size for
    a box query, omit its tier to retrieve identities, or follow the problem's `links.downloads` to the
    boundary release metadata and its whole-release downloads.

    Args:
        geography (str):
        release (str):
        code (str):
        tier (GetAreaChildrenGeometryTier | Unset):  Default: GetAreaChildrenGeometryTier.FULL.
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaChildrenGeometryEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            tier=tier,
            child_geography=child_geography,
        )
    ).parsed
