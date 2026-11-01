from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_box_search_envelope import AreaBoxSearchEnvelope
from ...models.find_areas_intersecting_box_tier import FindAreasIntersectingBoxTier
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    bbox: str,
    geography: str,
    release: str | Unset = "latest",
    tier: FindAreasIntersectingBoxTier | Unset = UNSET,
    limit: int | Unset = 200,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["bbox"] = bbox

    params["geography"] = geography

    params["release"] = release

    json_tier: str | Unset = UNSET
    if not isinstance(tier, Unset):
        json_tier = tier.value

    params["tier"] = json_tier

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas:intersects",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaBoxSearchEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaBoxSearchEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

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
) -> Response[AreaBoxSearchEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    bbox: str,
    geography: str,
    release: str | Unset = "latest",
    tier: FindAreasIntersectingBoxTier | Unset = UNSET,
    limit: int | Unset = 200,
    cursor: str | Unset = UNSET,
) -> Response[AreaBoxSearchEnvelope | Problem]:
    """Find the areas meeting a bounding box in one release

     Returns every area of one geography and release that meets the given WGS 84 box: the query a map
    makes when it pans, and the one an analysis makes to scope a region before asking for anything
    heavier.

    `relation` says how each area meets the box. `within` means the area lies entirely inside it;
    `overlaps` means it meets the box without being contained by it. Both are exact. An area is tested
    against the box itself, not against its own bounding box, so a crescent whose bounding box reaches
    into the query while its land does not is excluded, as is a box sitting inside a lake within an
    area.

    Identities come back by default, each with its own bounding box, and the coordinates are opted into
    with `tier`, which generalises every match exactly as the geometry route does. That keeps the cost
    of a wide box bounded whether or not a caller wants geometry with it. The same caveat applies: above
    `full`, matches are generalised one at a time and neighbours drawn together may disagree along a
    shared border.

    Results come a page at a time in code order, `limit` to a page, 200 by default and 1000 at most.
    `matched` counts every area the box meets, `truncated` says whether more follow this page, and
    `nextCursor`, with a `Link: rel="next"` header, fetches them. For every area of a release, the
    whole-release download is quicker. The cap is on results rather than on the box: a box covering the
    whole country is a reasonable analysis question, and it is the geometry that is expensive, not the
    extent. A box matching nothing is an empty answer, not an error; a geography and release the
    catalogue does not carry is a 404. Geometry collections process at most 250,000 source vertices per
    request, counted before simplification. A larger request returns 422 without a partial collection.
    Reduce the page size for a box query, omit its tier to retrieve identities, or follow the problem's
    `links.downloads` to the boundary release metadata and its whole-release downloads.

    Args:
        bbox (str):
        geography (str):
        release (str | Unset):  Default: 'latest'.
        tier (FindAreasIntersectingBoxTier | Unset):
        limit (int | Unset):  Default: 200.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaBoxSearchEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        bbox=bbox,
        geography=geography,
        release=release,
        tier=tier,
        limit=limit,
        cursor=cursor,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    bbox: str,
    geography: str,
    release: str | Unset = "latest",
    tier: FindAreasIntersectingBoxTier | Unset = UNSET,
    limit: int | Unset = 200,
    cursor: str | Unset = UNSET,
) -> AreaBoxSearchEnvelope | Problem | None:
    """Find the areas meeting a bounding box in one release

     Returns every area of one geography and release that meets the given WGS 84 box: the query a map
    makes when it pans, and the one an analysis makes to scope a region before asking for anything
    heavier.

    `relation` says how each area meets the box. `within` means the area lies entirely inside it;
    `overlaps` means it meets the box without being contained by it. Both are exact. An area is tested
    against the box itself, not against its own bounding box, so a crescent whose bounding box reaches
    into the query while its land does not is excluded, as is a box sitting inside a lake within an
    area.

    Identities come back by default, each with its own bounding box, and the coordinates are opted into
    with `tier`, which generalises every match exactly as the geometry route does. That keeps the cost
    of a wide box bounded whether or not a caller wants geometry with it. The same caveat applies: above
    `full`, matches are generalised one at a time and neighbours drawn together may disagree along a
    shared border.

    Results come a page at a time in code order, `limit` to a page, 200 by default and 1000 at most.
    `matched` counts every area the box meets, `truncated` says whether more follow this page, and
    `nextCursor`, with a `Link: rel="next"` header, fetches them. For every area of a release, the
    whole-release download is quicker. The cap is on results rather than on the box: a box covering the
    whole country is a reasonable analysis question, and it is the geometry that is expensive, not the
    extent. A box matching nothing is an empty answer, not an error; a geography and release the
    catalogue does not carry is a 404. Geometry collections process at most 250,000 source vertices per
    request, counted before simplification. A larger request returns 422 without a partial collection.
    Reduce the page size for a box query, omit its tier to retrieve identities, or follow the problem's
    `links.downloads` to the boundary release metadata and its whole-release downloads.

    Args:
        bbox (str):
        geography (str):
        release (str | Unset):  Default: 'latest'.
        tier (FindAreasIntersectingBoxTier | Unset):
        limit (int | Unset):  Default: 200.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaBoxSearchEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        bbox=bbox,
        geography=geography,
        release=release,
        tier=tier,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    bbox: str,
    geography: str,
    release: str | Unset = "latest",
    tier: FindAreasIntersectingBoxTier | Unset = UNSET,
    limit: int | Unset = 200,
    cursor: str | Unset = UNSET,
) -> Response[AreaBoxSearchEnvelope | Problem]:
    """Find the areas meeting a bounding box in one release

     Returns every area of one geography and release that meets the given WGS 84 box: the query a map
    makes when it pans, and the one an analysis makes to scope a region before asking for anything
    heavier.

    `relation` says how each area meets the box. `within` means the area lies entirely inside it;
    `overlaps` means it meets the box without being contained by it. Both are exact. An area is tested
    against the box itself, not against its own bounding box, so a crescent whose bounding box reaches
    into the query while its land does not is excluded, as is a box sitting inside a lake within an
    area.

    Identities come back by default, each with its own bounding box, and the coordinates are opted into
    with `tier`, which generalises every match exactly as the geometry route does. That keeps the cost
    of a wide box bounded whether or not a caller wants geometry with it. The same caveat applies: above
    `full`, matches are generalised one at a time and neighbours drawn together may disagree along a
    shared border.

    Results come a page at a time in code order, `limit` to a page, 200 by default and 1000 at most.
    `matched` counts every area the box meets, `truncated` says whether more follow this page, and
    `nextCursor`, with a `Link: rel="next"` header, fetches them. For every area of a release, the
    whole-release download is quicker. The cap is on results rather than on the box: a box covering the
    whole country is a reasonable analysis question, and it is the geometry that is expensive, not the
    extent. A box matching nothing is an empty answer, not an error; a geography and release the
    catalogue does not carry is a 404. Geometry collections process at most 250,000 source vertices per
    request, counted before simplification. A larger request returns 422 without a partial collection.
    Reduce the page size for a box query, omit its tier to retrieve identities, or follow the problem's
    `links.downloads` to the boundary release metadata and its whole-release downloads.

    Args:
        bbox (str):
        geography (str):
        release (str | Unset):  Default: 'latest'.
        tier (FindAreasIntersectingBoxTier | Unset):
        limit (int | Unset):  Default: 200.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaBoxSearchEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        bbox=bbox,
        geography=geography,
        release=release,
        tier=tier,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    bbox: str,
    geography: str,
    release: str | Unset = "latest",
    tier: FindAreasIntersectingBoxTier | Unset = UNSET,
    limit: int | Unset = 200,
    cursor: str | Unset = UNSET,
) -> AreaBoxSearchEnvelope | Problem | None:
    """Find the areas meeting a bounding box in one release

     Returns every area of one geography and release that meets the given WGS 84 box: the query a map
    makes when it pans, and the one an analysis makes to scope a region before asking for anything
    heavier.

    `relation` says how each area meets the box. `within` means the area lies entirely inside it;
    `overlaps` means it meets the box without being contained by it. Both are exact. An area is tested
    against the box itself, not against its own bounding box, so a crescent whose bounding box reaches
    into the query while its land does not is excluded, as is a box sitting inside a lake within an
    area.

    Identities come back by default, each with its own bounding box, and the coordinates are opted into
    with `tier`, which generalises every match exactly as the geometry route does. That keeps the cost
    of a wide box bounded whether or not a caller wants geometry with it. The same caveat applies: above
    `full`, matches are generalised one at a time and neighbours drawn together may disagree along a
    shared border.

    Results come a page at a time in code order, `limit` to a page, 200 by default and 1000 at most.
    `matched` counts every area the box meets, `truncated` says whether more follow this page, and
    `nextCursor`, with a `Link: rel="next"` header, fetches them. For every area of a release, the
    whole-release download is quicker. The cap is on results rather than on the box: a box covering the
    whole country is a reasonable analysis question, and it is the geometry that is expensive, not the
    extent. A box matching nothing is an empty answer, not an error; a geography and release the
    catalogue does not carry is a 404. Geometry collections process at most 250,000 source vertices per
    request, counted before simplification. A larger request returns 422 without a partial collection.
    Reduce the page size for a box query, omit its tier to retrieve identities, or follow the problem's
    `links.downloads` to the boundary release metadata and its whole-release downloads.

    Args:
        bbox (str):
        geography (str):
        release (str | Unset):  Default: 'latest'.
        tier (FindAreasIntersectingBoxTier | Unset):
        limit (int | Unset):  Default: 200.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaBoxSearchEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            bbox=bbox,
            geography=geography,
            release=release,
            tier=tier,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
