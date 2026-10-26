from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_named_location_parents_response_200 import (
    GetNamedLocationParentsResponse200,
)
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    location_id: str,
    *,
    geography: str,
    release: str,
    via: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["release"] = release

    params["via"] = via

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/locations/{location_id}/parents".format(
            location_id=quote(str(location_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetNamedLocationParentsResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetNamedLocationParentsResponse200.from_dict(response.json())

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
) -> Response[GetNamedLocationParentsResponse200 | Problem]:
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
    geography: str,
    release: str,
    via: str | Unset = UNSET,
) -> Response[GetNamedLocationParentsResponse200 | Problem]:
    """Find the areas of a coarser geography a named location covers or meets

     The other direction from `members`: which regions, counties, combined authorities or countries a
    location lies in, and whether it takes in each one whole. A location is defined by codes in its
    declared `memberGeography`, so a parent geography is reached through a published crosswalk out of
    that geography, named with `via`; asking without it lists the crosswalks published for that
    geography and release.

    Each parent's `relation` is `covers` when the location takes in all of it and `intersects` when it
    takes in only part. Through a containment or membership lookup that is decided by count, and
    `parentMemberCount` says how many authorities the publisher places in the parent. Through an area-
    overlap crosswalk it is decided by area, and `coveredShare` is the share of the parent the
    location's members cover, with 0.99 or more counting as cover. `members` lists the location's own
    authorities in each parent.

    `locationWithin` names the single parent holding every member, and is null when the members fall in
    several parents or the crosswalk places any of them in none. Those are listed in `unplaced`: a Welsh
    authority under an English region lookup, or a district outside every combined authority. `coverage`
    classifies the location's codes against the authority release the crosswalk starts from, exactly as
    on `members`.

    Every answer is compiled in advance for each location and crosswalk, so this reads a projection
    rather than walking a crosswalk per request.

    Args:
        location_id (str):
        geography (str):
        release (str):
        via (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationParentsResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        geography=geography,
        release=release,
        via=via,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    release: str,
    via: str | Unset = UNSET,
) -> GetNamedLocationParentsResponse200 | Problem | None:
    """Find the areas of a coarser geography a named location covers or meets

     The other direction from `members`: which regions, counties, combined authorities or countries a
    location lies in, and whether it takes in each one whole. A location is defined by codes in its
    declared `memberGeography`, so a parent geography is reached through a published crosswalk out of
    that geography, named with `via`; asking without it lists the crosswalks published for that
    geography and release.

    Each parent's `relation` is `covers` when the location takes in all of it and `intersects` when it
    takes in only part. Through a containment or membership lookup that is decided by count, and
    `parentMemberCount` says how many authorities the publisher places in the parent. Through an area-
    overlap crosswalk it is decided by area, and `coveredShare` is the share of the parent the
    location's members cover, with 0.99 or more counting as cover. `members` lists the location's own
    authorities in each parent.

    `locationWithin` names the single parent holding every member, and is null when the members fall in
    several parents or the crosswalk places any of them in none. Those are listed in `unplaced`: a Welsh
    authority under an English region lookup, or a district outside every combined authority. `coverage`
    classifies the location's codes against the authority release the crosswalk starts from, exactly as
    on `members`.

    Every answer is compiled in advance for each location and crosswalk, so this reads a projection
    rather than walking a crosswalk per request.

    Args:
        location_id (str):
        geography (str):
        release (str):
        via (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationParentsResponse200 | Problem
    """

    return sync_detailed(
        location_id=location_id,
        client=client,
        geography=geography,
        release=release,
        via=via,
    ).parsed


async def asyncio_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    release: str,
    via: str | Unset = UNSET,
) -> Response[GetNamedLocationParentsResponse200 | Problem]:
    """Find the areas of a coarser geography a named location covers or meets

     The other direction from `members`: which regions, counties, combined authorities or countries a
    location lies in, and whether it takes in each one whole. A location is defined by codes in its
    declared `memberGeography`, so a parent geography is reached through a published crosswalk out of
    that geography, named with `via`; asking without it lists the crosswalks published for that
    geography and release.

    Each parent's `relation` is `covers` when the location takes in all of it and `intersects` when it
    takes in only part. Through a containment or membership lookup that is decided by count, and
    `parentMemberCount` says how many authorities the publisher places in the parent. Through an area-
    overlap crosswalk it is decided by area, and `coveredShare` is the share of the parent the
    location's members cover, with 0.99 or more counting as cover. `members` lists the location's own
    authorities in each parent.

    `locationWithin` names the single parent holding every member, and is null when the members fall in
    several parents or the crosswalk places any of them in none. Those are listed in `unplaced`: a Welsh
    authority under an English region lookup, or a district outside every combined authority. `coverage`
    classifies the location's codes against the authority release the crosswalk starts from, exactly as
    on `members`.

    Every answer is compiled in advance for each location and crosswalk, so this reads a projection
    rather than walking a crosswalk per request.

    Args:
        location_id (str):
        geography (str):
        release (str):
        via (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationParentsResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        geography=geography,
        release=release,
        via=via,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    release: str,
    via: str | Unset = UNSET,
) -> GetNamedLocationParentsResponse200 | Problem | None:
    """Find the areas of a coarser geography a named location covers or meets

     The other direction from `members`: which regions, counties, combined authorities or countries a
    location lies in, and whether it takes in each one whole. A location is defined by codes in its
    declared `memberGeography`, so a parent geography is reached through a published crosswalk out of
    that geography, named with `via`; asking without it lists the crosswalks published for that
    geography and release.

    Each parent's `relation` is `covers` when the location takes in all of it and `intersects` when it
    takes in only part. Through a containment or membership lookup that is decided by count, and
    `parentMemberCount` says how many authorities the publisher places in the parent. Through an area-
    overlap crosswalk it is decided by area, and `coveredShare` is the share of the parent the
    location's members cover, with 0.99 or more counting as cover. `members` lists the location's own
    authorities in each parent.

    `locationWithin` names the single parent holding every member, and is null when the members fall in
    several parents or the crosswalk places any of them in none. Those are listed in `unplaced`: a Welsh
    authority under an English region lookup, or a district outside every combined authority. `coverage`
    classifies the location's codes against the authority release the crosswalk starts from, exactly as
    on `members`.

    Every answer is compiled in advance for each location and crosswalk, so this reads a projection
    rather than walking a crosswalk per request.

    Args:
        location_id (str):
        geography (str):
        release (str):
        via (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationParentsResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            location_id=location_id,
            client=client,
            geography=geography,
            release=release,
            via=via,
        )
    ).parsed
