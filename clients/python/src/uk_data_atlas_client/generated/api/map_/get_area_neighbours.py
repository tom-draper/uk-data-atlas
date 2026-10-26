from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_neighbours_envelope import AreaNeighboursEnvelope
from ...models.get_area_neighbours_touches import GetAreaNeighboursTouches
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    touches: GetAreaNeighboursTouches | Unset = GetAreaNeighboursTouches.EDGE,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_touches: str | Unset = UNSET
    if not isinstance(touches, Unset):
        json_touches = touches.value

    params["touches"] = json_touches

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/neighbours".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaNeighboursEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaNeighboursEnvelope.from_dict(response.json())

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
) -> Response[AreaNeighboursEnvelope | Problem]:
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
    touches: GetAreaNeighboursTouches | Unset = GetAreaNeighboursTouches.EDGE,
) -> Response[AreaNeighboursEnvelope | Problem]:
    """List the areas whose boundary meets this one's

     Returns the areas next to this one within the same geography and release, each with the length of
    the border they share. This supports local comparison, map navigation and spatial modelling: "how
    does this ward compare with the ones around it" needs to know which those are.

    Neighbours are found from shared vertices, not from a distance threshold. Adjacent areas in one
    published release are drawn from the same vertices, so a common border is the same coordinates on
    both sides and matches exactly; the shared length is summed over those edges, each counted once,
    with ground length from the ellipsoid's radii of curvature. Nobody picks a tolerance, and nothing is
    approximate.

    `touches` decides whether areas meeting at a single point count. `edge`, the default, returns only
    areas sharing a border with length; `any` also returns those meeting at a corner, whose
    `sharedBorderM` is zero. Four areas at a crossroads are not neighbours of each other in any sense
    useful for comparison or for colouring a map, so they are excluded unless asked for;
    `border.pointOnlyTouches` counts them either way, so their exclusion is visible rather than silent.
    They are real: none occur between local authorities, while about 3% of ward adjacencies are corners.

    `border` totals the perimeter, the border shared with the neighbours returned, and the remainder.
    For a landlocked area the remainder is nothing; otherwise it is coastline, a national boundary, or a
    border with an area outside this release. Birmingham shares 100% of its perimeter across seven
    neighbours; the Isle of Wight has none, and all 188.7 km of its boundary is its own.

    Within one geography and release only. Two areas that genuinely touch on the ground but were drawn
    from different vertices are not found, which is why this is not offered across releases.

    Args:
        geography (str):
        release (str):
        code (str):
        touches (GetAreaNeighboursTouches | Unset):  Default: GetAreaNeighboursTouches.EDGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaNeighboursEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        touches=touches,
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
    touches: GetAreaNeighboursTouches | Unset = GetAreaNeighboursTouches.EDGE,
) -> AreaNeighboursEnvelope | Problem | None:
    """List the areas whose boundary meets this one's

     Returns the areas next to this one within the same geography and release, each with the length of
    the border they share. This supports local comparison, map navigation and spatial modelling: "how
    does this ward compare with the ones around it" needs to know which those are.

    Neighbours are found from shared vertices, not from a distance threshold. Adjacent areas in one
    published release are drawn from the same vertices, so a common border is the same coordinates on
    both sides and matches exactly; the shared length is summed over those edges, each counted once,
    with ground length from the ellipsoid's radii of curvature. Nobody picks a tolerance, and nothing is
    approximate.

    `touches` decides whether areas meeting at a single point count. `edge`, the default, returns only
    areas sharing a border with length; `any` also returns those meeting at a corner, whose
    `sharedBorderM` is zero. Four areas at a crossroads are not neighbours of each other in any sense
    useful for comparison or for colouring a map, so they are excluded unless asked for;
    `border.pointOnlyTouches` counts them either way, so their exclusion is visible rather than silent.
    They are real: none occur between local authorities, while about 3% of ward adjacencies are corners.

    `border` totals the perimeter, the border shared with the neighbours returned, and the remainder.
    For a landlocked area the remainder is nothing; otherwise it is coastline, a national boundary, or a
    border with an area outside this release. Birmingham shares 100% of its perimeter across seven
    neighbours; the Isle of Wight has none, and all 188.7 km of its boundary is its own.

    Within one geography and release only. Two areas that genuinely touch on the ground but were drawn
    from different vertices are not found, which is why this is not offered across releases.

    Args:
        geography (str):
        release (str):
        code (str):
        touches (GetAreaNeighboursTouches | Unset):  Default: GetAreaNeighboursTouches.EDGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaNeighboursEnvelope | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        touches=touches,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    touches: GetAreaNeighboursTouches | Unset = GetAreaNeighboursTouches.EDGE,
) -> Response[AreaNeighboursEnvelope | Problem]:
    """List the areas whose boundary meets this one's

     Returns the areas next to this one within the same geography and release, each with the length of
    the border they share. This supports local comparison, map navigation and spatial modelling: "how
    does this ward compare with the ones around it" needs to know which those are.

    Neighbours are found from shared vertices, not from a distance threshold. Adjacent areas in one
    published release are drawn from the same vertices, so a common border is the same coordinates on
    both sides and matches exactly; the shared length is summed over those edges, each counted once,
    with ground length from the ellipsoid's radii of curvature. Nobody picks a tolerance, and nothing is
    approximate.

    `touches` decides whether areas meeting at a single point count. `edge`, the default, returns only
    areas sharing a border with length; `any` also returns those meeting at a corner, whose
    `sharedBorderM` is zero. Four areas at a crossroads are not neighbours of each other in any sense
    useful for comparison or for colouring a map, so they are excluded unless asked for;
    `border.pointOnlyTouches` counts them either way, so their exclusion is visible rather than silent.
    They are real: none occur between local authorities, while about 3% of ward adjacencies are corners.

    `border` totals the perimeter, the border shared with the neighbours returned, and the remainder.
    For a landlocked area the remainder is nothing; otherwise it is coastline, a national boundary, or a
    border with an area outside this release. Birmingham shares 100% of its perimeter across seven
    neighbours; the Isle of Wight has none, and all 188.7 km of its boundary is its own.

    Within one geography and release only. Two areas that genuinely touch on the ground but were drawn
    from different vertices are not found, which is why this is not offered across releases.

    Args:
        geography (str):
        release (str):
        code (str):
        touches (GetAreaNeighboursTouches | Unset):  Default: GetAreaNeighboursTouches.EDGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaNeighboursEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        touches=touches,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    touches: GetAreaNeighboursTouches | Unset = GetAreaNeighboursTouches.EDGE,
) -> AreaNeighboursEnvelope | Problem | None:
    """List the areas whose boundary meets this one's

     Returns the areas next to this one within the same geography and release, each with the length of
    the border they share. This supports local comparison, map navigation and spatial modelling: "how
    does this ward compare with the ones around it" needs to know which those are.

    Neighbours are found from shared vertices, not from a distance threshold. Adjacent areas in one
    published release are drawn from the same vertices, so a common border is the same coordinates on
    both sides and matches exactly; the shared length is summed over those edges, each counted once,
    with ground length from the ellipsoid's radii of curvature. Nobody picks a tolerance, and nothing is
    approximate.

    `touches` decides whether areas meeting at a single point count. `edge`, the default, returns only
    areas sharing a border with length; `any` also returns those meeting at a corner, whose
    `sharedBorderM` is zero. Four areas at a crossroads are not neighbours of each other in any sense
    useful for comparison or for colouring a map, so they are excluded unless asked for;
    `border.pointOnlyTouches` counts them either way, so their exclusion is visible rather than silent.
    They are real: none occur between local authorities, while about 3% of ward adjacencies are corners.

    `border` totals the perimeter, the border shared with the neighbours returned, and the remainder.
    For a landlocked area the remainder is nothing; otherwise it is coastline, a national boundary, or a
    border with an area outside this release. Birmingham shares 100% of its perimeter across seven
    neighbours; the Isle of Wight has none, and all 188.7 km of its boundary is its own.

    Within one geography and release only. Two areas that genuinely touch on the ground but were drawn
    from different vertices are not found, which is why this is not offered across releases.

    Args:
        geography (str):
        release (str):
        code (str):
        touches (GetAreaNeighboursTouches | Unset):  Default: GetAreaNeighboursTouches.EDGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaNeighboursEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            touches=touches,
        )
    ).parsed
