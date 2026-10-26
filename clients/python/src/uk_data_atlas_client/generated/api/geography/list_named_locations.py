import datetime
from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.list_named_locations_response_200 import ListNamedLocationsResponse200
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    q: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["q"] = q

    json_as_of: str | Unset = UNSET
    if not isinstance(as_of, Unset):
        json_as_of = as_of.isoformat()
    params["asOf"] = json_as_of

    params["cursor"] = cursor

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/locations",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ListNamedLocationsResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = ListNamedLocationsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ListNamedLocationsResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,
) -> Response[ListNamedLocationsResponse200 | Problem]:
    """List the curated area collections

     A named location is a curated area collection. Most are editorial groupings of area codes (`kind:
    editorial-grouping`), kept because people ask for places the official geographies do not name.
    Countries, English regions, Greater Manchester and some counties are official areas (`kind:
    country`, `region`, `combined-authority` or `county`), and all but countries name the ONS lookup
    their current members come from in `source`.

    The ceremonial counties of England and preserved counties of Wales, which is what most people mean
    by Lancashire or Kent, are `kind: ceremonial-county`. No ONS lookup defines them, so `source` names
    Ordnance Survey's Boundary-Line polygons and the method: each local authority of every compiled
    release is a member of the county holding most of its area, and dated by the releases it appears in,
    so a county keeps the councils it had before a reorganisation. An authority split between counties,
    as Stockton-on-Tees is between County Durham and North Yorkshire, is a member of the one holding
    most of it and listed with its share in the other's `partialMembers`. A county that shares its name
    with a different official area, as the West Midlands shares the region's, is `{id}-ceremonial-
    county`; one with the same councils as an official county is that county. Scotland's lieutenancy
    areas do not follow council boundaries and are not included.

    None is a generic geographic location, and membership holds only through a crosswalk the caller
    names. `q` matches an id or label prefix. `definitionRevision` identifies the curated definition
    used; `validity` gives its known bounds, with null bounds when the curator has not supplied dates.
    `memberAssertions` gives each member code's half-open effective interval; `asOf` selects the
    definition active on one date. Geometry is deliberately omitted from this paginated listing; fetch a
    selected location's geometry from `/v1/locations/{location-id}/geometry`.

    Args:
        q (str | Unset):
        as_of (datetime.date | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListNamedLocationsResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        q=q,
        as_of=as_of,
        cursor=cursor,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,
) -> ListNamedLocationsResponse200 | Problem | None:
    """List the curated area collections

     A named location is a curated area collection. Most are editorial groupings of area codes (`kind:
    editorial-grouping`), kept because people ask for places the official geographies do not name.
    Countries, English regions, Greater Manchester and some counties are official areas (`kind:
    country`, `region`, `combined-authority` or `county`), and all but countries name the ONS lookup
    their current members come from in `source`.

    The ceremonial counties of England and preserved counties of Wales, which is what most people mean
    by Lancashire or Kent, are `kind: ceremonial-county`. No ONS lookup defines them, so `source` names
    Ordnance Survey's Boundary-Line polygons and the method: each local authority of every compiled
    release is a member of the county holding most of its area, and dated by the releases it appears in,
    so a county keeps the councils it had before a reorganisation. An authority split between counties,
    as Stockton-on-Tees is between County Durham and North Yorkshire, is a member of the one holding
    most of it and listed with its share in the other's `partialMembers`. A county that shares its name
    with a different official area, as the West Midlands shares the region's, is `{id}-ceremonial-
    county`; one with the same councils as an official county is that county. Scotland's lieutenancy
    areas do not follow council boundaries and are not included.

    None is a generic geographic location, and membership holds only through a crosswalk the caller
    names. `q` matches an id or label prefix. `definitionRevision` identifies the curated definition
    used; `validity` gives its known bounds, with null bounds when the curator has not supplied dates.
    `memberAssertions` gives each member code's half-open effective interval; `asOf` selects the
    definition active on one date. Geometry is deliberately omitted from this paginated listing; fetch a
    selected location's geometry from `/v1/locations/{location-id}/geometry`.

    Args:
        q (str | Unset):
        as_of (datetime.date | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListNamedLocationsResponse200 | Problem
    """

    return sync_detailed(
        client=client,
        q=q,
        as_of=as_of,
        cursor=cursor,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,
) -> Response[ListNamedLocationsResponse200 | Problem]:
    """List the curated area collections

     A named location is a curated area collection. Most are editorial groupings of area codes (`kind:
    editorial-grouping`), kept because people ask for places the official geographies do not name.
    Countries, English regions, Greater Manchester and some counties are official areas (`kind:
    country`, `region`, `combined-authority` or `county`), and all but countries name the ONS lookup
    their current members come from in `source`.

    The ceremonial counties of England and preserved counties of Wales, which is what most people mean
    by Lancashire or Kent, are `kind: ceremonial-county`. No ONS lookup defines them, so `source` names
    Ordnance Survey's Boundary-Line polygons and the method: each local authority of every compiled
    release is a member of the county holding most of its area, and dated by the releases it appears in,
    so a county keeps the councils it had before a reorganisation. An authority split between counties,
    as Stockton-on-Tees is between County Durham and North Yorkshire, is a member of the one holding
    most of it and listed with its share in the other's `partialMembers`. A county that shares its name
    with a different official area, as the West Midlands shares the region's, is `{id}-ceremonial-
    county`; one with the same councils as an official county is that county. Scotland's lieutenancy
    areas do not follow council boundaries and are not included.

    None is a generic geographic location, and membership holds only through a crosswalk the caller
    names. `q` matches an id or label prefix. `definitionRevision` identifies the curated definition
    used; `validity` gives its known bounds, with null bounds when the curator has not supplied dates.
    `memberAssertions` gives each member code's half-open effective interval; `asOf` selects the
    definition active on one date. Geometry is deliberately omitted from this paginated listing; fetch a
    selected location's geometry from `/v1/locations/{location-id}/geometry`.

    Args:
        q (str | Unset):
        as_of (datetime.date | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListNamedLocationsResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        q=q,
        as_of=as_of,
        cursor=cursor,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    as_of: datetime.date | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,
) -> ListNamedLocationsResponse200 | Problem | None:
    """List the curated area collections

     A named location is a curated area collection. Most are editorial groupings of area codes (`kind:
    editorial-grouping`), kept because people ask for places the official geographies do not name.
    Countries, English regions, Greater Manchester and some counties are official areas (`kind:
    country`, `region`, `combined-authority` or `county`), and all but countries name the ONS lookup
    their current members come from in `source`.

    The ceremonial counties of England and preserved counties of Wales, which is what most people mean
    by Lancashire or Kent, are `kind: ceremonial-county`. No ONS lookup defines them, so `source` names
    Ordnance Survey's Boundary-Line polygons and the method: each local authority of every compiled
    release is a member of the county holding most of its area, and dated by the releases it appears in,
    so a county keeps the councils it had before a reorganisation. An authority split between counties,
    as Stockton-on-Tees is between County Durham and North Yorkshire, is a member of the one holding
    most of it and listed with its share in the other's `partialMembers`. A county that shares its name
    with a different official area, as the West Midlands shares the region's, is `{id}-ceremonial-
    county`; one with the same councils as an official county is that county. Scotland's lieutenancy
    areas do not follow council boundaries and are not included.

    None is a generic geographic location, and membership holds only through a crosswalk the caller
    names. `q` matches an id or label prefix. `definitionRevision` identifies the curated definition
    used; `validity` gives its known bounds, with null bounds when the curator has not supplied dates.
    `memberAssertions` gives each member code's half-open effective interval; `asOf` selects the
    definition active on one date. Geometry is deliberately omitted from this paginated listing; fetch a
    selected location's geometry from `/v1/locations/{location-id}/geometry`.

    Args:
        q (str | Unset):
        as_of (datetime.date | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListNamedLocationsResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            q=q,
            as_of=as_of,
            cursor=cursor,
            limit=limit,
        )
    ).parsed
