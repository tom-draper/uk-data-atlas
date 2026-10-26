import datetime
from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_named_location_members_response_200 import (
    GetNamedLocationMembersResponse200,
)
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    location_id: str,
    *,
    geography: str | Unset = UNSET,
    release: str,
    via: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["release"] = release

    params["via"] = via

    json_as_of: str | Unset = UNSET
    if not isinstance(as_of, Unset):
        json_as_of = as_of.isoformat()
    params["asOf"] = json_as_of

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/locations/{location_id}/members".format(
            location_id=quote(str(location_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetNamedLocationMembersResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetNamedLocationMembersResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetNamedLocationMembersResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str,
    via: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
) -> Response[GetNamedLocationMembersResponse200 | Problem]:
    """Resolve a named location's members in one geography and release

     `release` is required because location definitions may include legacy codes. Missing members are
    returned explicitly; this route never applies an implicit historical conversion. A `coverage` object
    counts resolved and unresolved members and classifies each unresolved code against the compiled
    releases of its geography as `superseded`, `not-yet-current`, `absent-from-release` or `unknown`,
    naming the releases that are the evidence. The classification is relative to the requested release
    and reports code membership only; it asserts nothing about geometry.

    A location declares the geography of its member codes, so asking for that geography matches them
    directly and `membership` is `direct-code-match`. Any other geography has to be reached through a
    published crosswalk, named with `via`: the wards of North Wales, the constituencies of Merseyside.
    Asking without `via` returns a 400 that lists the crosswalks published for that geography and
    release, so the choice is the caller's and is made from what exists.

    What membership means depends on the crosswalk named, and the response says which. Through a `clean-
    containment` crosswalk it is `fully-contained`: the publisher places each area wholly inside one
    parent, so no area is counted in part. Through an `area-overlap` crosswalk it is `weighted-overlap`:
    an area straddling the edge of the location carries the `weight` lying inside and is marked
    `partial`, and `partialMembers` counts them. Shares in two members of the same location are added,
    so an area split between them is whole and not partial.

    Each member names the defining area it was found `through`, and `parentBoundaryRelease` names the
    release the location's own codes were resolved against, which is the release the crosswalk ends at
    rather than the one asked for. Each member's `relation` is `within` when the whole area lies inside
    the location and `partly-within` when only its `weight` does; only the first may be counted whole.

    `reach` says which of the location's authorities the crosswalk places any area under. A crosswalk
    covering fewer countries than the location spans, such as LSOAs for a Scottish city, leaves
    authorities in `unreached`, and the members under them are missing from the answer rather than
    absent from the ground.

    Args:
        location_id (str):
        geography (str | Unset):
        release (str):
        via (str | Unset):
        as_of (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationMembersResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        geography=geography,
        release=release,
        via=via,
        as_of=as_of,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str,
    via: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
) -> GetNamedLocationMembersResponse200 | Problem | None:
    """Resolve a named location's members in one geography and release

     `release` is required because location definitions may include legacy codes. Missing members are
    returned explicitly; this route never applies an implicit historical conversion. A `coverage` object
    counts resolved and unresolved members and classifies each unresolved code against the compiled
    releases of its geography as `superseded`, `not-yet-current`, `absent-from-release` or `unknown`,
    naming the releases that are the evidence. The classification is relative to the requested release
    and reports code membership only; it asserts nothing about geometry.

    A location declares the geography of its member codes, so asking for that geography matches them
    directly and `membership` is `direct-code-match`. Any other geography has to be reached through a
    published crosswalk, named with `via`: the wards of North Wales, the constituencies of Merseyside.
    Asking without `via` returns a 400 that lists the crosswalks published for that geography and
    release, so the choice is the caller's and is made from what exists.

    What membership means depends on the crosswalk named, and the response says which. Through a `clean-
    containment` crosswalk it is `fully-contained`: the publisher places each area wholly inside one
    parent, so no area is counted in part. Through an `area-overlap` crosswalk it is `weighted-overlap`:
    an area straddling the edge of the location carries the `weight` lying inside and is marked
    `partial`, and `partialMembers` counts them. Shares in two members of the same location are added,
    so an area split between them is whole and not partial.

    Each member names the defining area it was found `through`, and `parentBoundaryRelease` names the
    release the location's own codes were resolved against, which is the release the crosswalk ends at
    rather than the one asked for. Each member's `relation` is `within` when the whole area lies inside
    the location and `partly-within` when only its `weight` does; only the first may be counted whole.

    `reach` says which of the location's authorities the crosswalk places any area under. A crosswalk
    covering fewer countries than the location spans, such as LSOAs for a Scottish city, leaves
    authorities in `unreached`, and the members under them are missing from the answer rather than
    absent from the ground.

    Args:
        location_id (str):
        geography (str | Unset):
        release (str):
        via (str | Unset):
        as_of (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationMembersResponse200 | Problem
    """

    return sync_detailed(
        location_id=location_id,
        client=client,
        geography=geography,
        release=release,
        via=via,
        as_of=as_of,
    ).parsed


async def asyncio_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str,
    via: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
) -> Response[GetNamedLocationMembersResponse200 | Problem]:
    """Resolve a named location's members in one geography and release

     `release` is required because location definitions may include legacy codes. Missing members are
    returned explicitly; this route never applies an implicit historical conversion. A `coverage` object
    counts resolved and unresolved members and classifies each unresolved code against the compiled
    releases of its geography as `superseded`, `not-yet-current`, `absent-from-release` or `unknown`,
    naming the releases that are the evidence. The classification is relative to the requested release
    and reports code membership only; it asserts nothing about geometry.

    A location declares the geography of its member codes, so asking for that geography matches them
    directly and `membership` is `direct-code-match`. Any other geography has to be reached through a
    published crosswalk, named with `via`: the wards of North Wales, the constituencies of Merseyside.
    Asking without `via` returns a 400 that lists the crosswalks published for that geography and
    release, so the choice is the caller's and is made from what exists.

    What membership means depends on the crosswalk named, and the response says which. Through a `clean-
    containment` crosswalk it is `fully-contained`: the publisher places each area wholly inside one
    parent, so no area is counted in part. Through an `area-overlap` crosswalk it is `weighted-overlap`:
    an area straddling the edge of the location carries the `weight` lying inside and is marked
    `partial`, and `partialMembers` counts them. Shares in two members of the same location are added,
    so an area split between them is whole and not partial.

    Each member names the defining area it was found `through`, and `parentBoundaryRelease` names the
    release the location's own codes were resolved against, which is the release the crosswalk ends at
    rather than the one asked for. Each member's `relation` is `within` when the whole area lies inside
    the location and `partly-within` when only its `weight` does; only the first may be counted whole.

    `reach` says which of the location's authorities the crosswalk places any area under. A crosswalk
    covering fewer countries than the location spans, such as LSOAs for a Scottish city, leaves
    authorities in `unreached`, and the members under them are missing from the answer rather than
    absent from the ground.

    Args:
        location_id (str):
        geography (str | Unset):
        release (str):
        via (str | Unset):
        as_of (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationMembersResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        geography=geography,
        release=release,
        via=via,
        as_of=as_of,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str,
    via: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
) -> GetNamedLocationMembersResponse200 | Problem | None:
    """Resolve a named location's members in one geography and release

     `release` is required because location definitions may include legacy codes. Missing members are
    returned explicitly; this route never applies an implicit historical conversion. A `coverage` object
    counts resolved and unresolved members and classifies each unresolved code against the compiled
    releases of its geography as `superseded`, `not-yet-current`, `absent-from-release` or `unknown`,
    naming the releases that are the evidence. The classification is relative to the requested release
    and reports code membership only; it asserts nothing about geometry.

    A location declares the geography of its member codes, so asking for that geography matches them
    directly and `membership` is `direct-code-match`. Any other geography has to be reached through a
    published crosswalk, named with `via`: the wards of North Wales, the constituencies of Merseyside.
    Asking without `via` returns a 400 that lists the crosswalks published for that geography and
    release, so the choice is the caller's and is made from what exists.

    What membership means depends on the crosswalk named, and the response says which. Through a `clean-
    containment` crosswalk it is `fully-contained`: the publisher places each area wholly inside one
    parent, so no area is counted in part. Through an `area-overlap` crosswalk it is `weighted-overlap`:
    an area straddling the edge of the location carries the `weight` lying inside and is marked
    `partial`, and `partialMembers` counts them. Shares in two members of the same location are added,
    so an area split between them is whole and not partial.

    Each member names the defining area it was found `through`, and `parentBoundaryRelease` names the
    release the location's own codes were resolved against, which is the release the crosswalk ends at
    rather than the one asked for. Each member's `relation` is `within` when the whole area lies inside
    the location and `partly-within` when only its `weight` does; only the first may be counted whole.

    `reach` says which of the location's authorities the crosswalk places any area under. A crosswalk
    covering fewer countries than the location spans, such as LSOAs for a Scottish city, leaves
    authorities in `unreached`, and the members under them are missing from the answer rather than
    absent from the ground.

    Args:
        location_id (str):
        geography (str | Unset):
        release (str):
        via (str | Unset):
        as_of (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationMembersResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            location_id=location_id,
            client=client,
            geography=geography,
            release=release,
            via=via,
            as_of=as_of,
        )
    ).parsed
