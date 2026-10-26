from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_list_envelope import AreaListEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["release"] = release

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaListEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaListEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[AreaListEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[AreaListEnvelope | Problem]:
    """List compiled area identities

     Lists compiled area identities, optionally within one geography or boundary release (or `latest` for
    the newest unambiguous release), in a stable order with cursor pagination. To find an area by name,
    code or postcode, use `/places?q=`.

    Args:
        geography (str | Unset):
        release (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaListEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
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
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> AreaListEnvelope | Problem | None:
    """List compiled area identities

     Lists compiled area identities, optionally within one geography or boundary release (or `latest` for
    the newest unambiguous release), in a stable order with cursor pagination. To find an area by name,
    code or postcode, use `/places?q=`.

    Args:
        geography (str | Unset):
        release (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaListEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        geography=geography,
        release=release,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[AreaListEnvelope | Problem]:
    """List compiled area identities

     Lists compiled area identities, optionally within one geography or boundary release (or `latest` for
    the newest unambiguous release), in a stable order with cursor pagination. To find an area by name,
    code or postcode, use `/places?q=`.

    Args:
        geography (str | Unset):
        release (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaListEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> AreaListEnvelope | Problem | None:
    """List compiled area identities

     Lists compiled area identities, optionally within one geography or boundary release (or `latest` for
    the newest unambiguous release), in a stable order with cursor pagination. To find an area by name,
    code or postcode, use `/places?q=`.

    Args:
        geography (str | Unset):
        release (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaListEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            geography=geography,
            release=release,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
