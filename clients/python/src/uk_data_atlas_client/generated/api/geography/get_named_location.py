import datetime
from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_named_location_include_item import GetNamedLocationIncludeItem
from ...models.get_named_location_response_200 import GetNamedLocationResponse200
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    location_id: str,
    *,
    as_of: datetime.date | Unset = UNSET,
    include: list[GetNamedLocationIncludeItem] | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_as_of: str | Unset = UNSET
    if not isinstance(as_of, Unset):
        json_as_of = as_of.isoformat()
    params["asOf"] = json_as_of

    json_include: list[str] | Unset = UNSET
    if not isinstance(include, Unset):
        json_include = []
        for include_item_data in include:
            include_item = include_item_data.value
            json_include.append(include_item)

    params["include"] = json_include

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/locations/{location_id}".format(
            location_id=quote(str(location_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetNamedLocationResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetNamedLocationResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetNamedLocationResponse200 | Problem]:
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
    as_of: datetime.date | Unset = UNSET,
    include: list[GetNamedLocationIncludeItem] | Unset = UNSET,
) -> Response[GetNamedLocationResponse200 | Problem]:
    """Get one curated area collection's definition

    Args:
        location_id (str):
        as_of (datetime.date | Unset):
        include (list[GetNamedLocationIncludeItem] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        as_of=as_of,
        include=include,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    as_of: datetime.date | Unset = UNSET,
    include: list[GetNamedLocationIncludeItem] | Unset = UNSET,
) -> GetNamedLocationResponse200 | Problem | None:
    """Get one curated area collection's definition

    Args:
        location_id (str):
        as_of (datetime.date | Unset):
        include (list[GetNamedLocationIncludeItem] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationResponse200 | Problem
    """

    return sync_detailed(
        location_id=location_id,
        client=client,
        as_of=as_of,
        include=include,
    ).parsed


async def asyncio_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    as_of: datetime.date | Unset = UNSET,
    include: list[GetNamedLocationIncludeItem] | Unset = UNSET,
) -> Response[GetNamedLocationResponse200 | Problem]:
    """Get one curated area collection's definition

    Args:
        location_id (str):
        as_of (datetime.date | Unset):
        include (list[GetNamedLocationIncludeItem] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetNamedLocationResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        as_of=as_of,
        include=include,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    as_of: datetime.date | Unset = UNSET,
    include: list[GetNamedLocationIncludeItem] | Unset = UNSET,
) -> GetNamedLocationResponse200 | Problem | None:
    """Get one curated area collection's definition

    Args:
        location_id (str):
        as_of (datetime.date | Unset):
        include (list[GetNamedLocationIncludeItem] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetNamedLocationResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            location_id=location_id,
            client=client,
            as_of=as_of,
            include=include,
        )
    ).parsed
