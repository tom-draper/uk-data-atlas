from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_relationships_envelope import AreaRelationshipsEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    depth: int | Unset = UNSET,
    child_geography: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["depth"] = depth

    params["childGeography"] = child_geography

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/children".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AreaRelationshipsEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AreaRelationshipsEnvelope.from_dict(response.json())

        return response_200

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
) -> Response[AreaRelationshipsEnvelope | Problem]:
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
    depth: int | Unset = UNSET,
    child_geography: str | Unset = UNSET,
) -> Response[AreaRelationshipsEnvelope | Problem]:
    """List published clean-containment children for an area

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaRelationshipsEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        depth=depth,
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
    depth: int | Unset = UNSET,
    child_geography: str | Unset = UNSET,
) -> AreaRelationshipsEnvelope | Problem | None:
    """List published clean-containment children for an area

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaRelationshipsEnvelope | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        depth=depth,
        child_geography=child_geography,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    depth: int | Unset = UNSET,
    child_geography: str | Unset = UNSET,
) -> Response[AreaRelationshipsEnvelope | Problem]:
    """List published clean-containment children for an area

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AreaRelationshipsEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        depth=depth,
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
    depth: int | Unset = UNSET,
    child_geography: str | Unset = UNSET,
) -> AreaRelationshipsEnvelope | Problem | None:
    """List published clean-containment children for an area

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):
        child_geography (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AreaRelationshipsEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            depth=depth,
            child_geography=child_geography,
        )
    ).parsed
