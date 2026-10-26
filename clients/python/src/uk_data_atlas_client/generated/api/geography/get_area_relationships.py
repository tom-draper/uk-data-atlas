from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.area_relationships_envelope import AreaRelationshipsEnvelope
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/relationships".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
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
) -> Response[AreaRelationshipsEnvelope | Problem]:
    """Get published relationships for one compiled area

     Returns only relationships from published crosswalks. A clean-containment mapping is represented as
    within from child to parent and contains in reverse. An official historical lookup is represented as
    successor from source to target and predecessor in reverse; a one-to-many lookup is split-from on
    each new area and a many-to-one lookup is merged-from on the new area. An extent-continuity
    crosswalk is equivalent-to in both directions. An area-overlap mapping is represented as overlaps in
    both directions, with the shared area and its share of each side.

    Args:
        geography (str):
        release (str):
        code (str):

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
) -> AreaRelationshipsEnvelope | Problem | None:
    """Get published relationships for one compiled area

     Returns only relationships from published crosswalks. A clean-containment mapping is represented as
    within from child to parent and contains in reverse. An official historical lookup is represented as
    successor from source to target and predecessor in reverse; a one-to-many lookup is split-from on
    each new area and a many-to-one lookup is merged-from on the new area. An extent-continuity
    crosswalk is equivalent-to in both directions. An area-overlap mapping is represented as overlaps in
    both directions, with the shared area and its share of each side.

    Args:
        geography (str):
        release (str):
        code (str):

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
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[AreaRelationshipsEnvelope | Problem]:
    """Get published relationships for one compiled area

     Returns only relationships from published crosswalks. A clean-containment mapping is represented as
    within from child to parent and contains in reverse. An official historical lookup is represented as
    successor from source to target and predecessor in reverse; a one-to-many lookup is split-from on
    each new area and a many-to-one lookup is merged-from on the new area. An extent-continuity
    crosswalk is equivalent-to in both directions. An area-overlap mapping is represented as overlaps in
    both directions, with the shared area and its share of each side.

    Args:
        geography (str):
        release (str):
        code (str):

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
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
) -> AreaRelationshipsEnvelope | Problem | None:
    """Get published relationships for one compiled area

     Returns only relationships from published crosswalks. A clean-containment mapping is represented as
    within from child to parent and contains in reverse. An official historical lookup is represented as
    successor from source to target and predecessor in reverse; a one-to-many lookup is split-from on
    each new area and a many-to-one lookup is merged-from on the new area. An extent-continuity
    crosswalk is equivalent-to in both directions. An area-overlap mapping is represented as overlaps in
    both directions, with the shared area and its share of each side.

    Args:
        geography (str):
        release (str):
        code (str):

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
        )
    ).parsed
