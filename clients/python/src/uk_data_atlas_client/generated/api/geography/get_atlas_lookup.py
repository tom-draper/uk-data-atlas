from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_atlas_lookup_response_200 import GetAtlasLookupResponse200
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    lookup_id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/atlas-lookups/{lookup_id}.json".format(
            lookup_id=quote(str(lookup_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetAtlasLookupResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetAtlasLookupResponse200.from_dict(response.json())

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
) -> Response[GetAtlasLookupResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetAtlasLookupResponse200 | Problem]:
    """Download a containment or lineage lookup the atlas reads

     The web atlas cannot hold the crosswalks, so the build reduces them to compact lookups for the
    boundary releases the atlas draws, as the geography resolver answers them. Available ids are `area-
    lineage` (where each ward, local authority and constituency goes between releases), `boundary-
    mappings` (each ward's local authority and constituency), `constituency-lad-overlaps` (the share of
    each constituency every local authority holds), `parish-lad-mappings` and `lsoa-lad-mappings-{year}`
    for each LSOA year the atlas draws, such as `lsoa-lad-mappings-2021`. Their shapes follow the atlas
    and may change with it; the crosswalks and relationship routes are the stable way to ask the same
    questions.

    Args:
        lookup_id (str): A lookup id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetAtlasLookupResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        lookup_id=lookup_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetAtlasLookupResponse200 | Problem | None:
    """Download a containment or lineage lookup the atlas reads

     The web atlas cannot hold the crosswalks, so the build reduces them to compact lookups for the
    boundary releases the atlas draws, as the geography resolver answers them. Available ids are `area-
    lineage` (where each ward, local authority and constituency goes between releases), `boundary-
    mappings` (each ward's local authority and constituency), `constituency-lad-overlaps` (the share of
    each constituency every local authority holds), `parish-lad-mappings` and `lsoa-lad-mappings-{year}`
    for each LSOA year the atlas draws, such as `lsoa-lad-mappings-2021`. Their shapes follow the atlas
    and may change with it; the crosswalks and relationship routes are the stable way to ask the same
    questions.

    Args:
        lookup_id (str): A lookup id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetAtlasLookupResponse200 | Problem
    """

    return sync_detailed(
        lookup_id=lookup_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetAtlasLookupResponse200 | Problem]:
    """Download a containment or lineage lookup the atlas reads

     The web atlas cannot hold the crosswalks, so the build reduces them to compact lookups for the
    boundary releases the atlas draws, as the geography resolver answers them. Available ids are `area-
    lineage` (where each ward, local authority and constituency goes between releases), `boundary-
    mappings` (each ward's local authority and constituency), `constituency-lad-overlaps` (the share of
    each constituency every local authority holds), `parish-lad-mappings` and `lsoa-lad-mappings-{year}`
    for each LSOA year the atlas draws, such as `lsoa-lad-mappings-2021`. Their shapes follow the atlas
    and may change with it; the crosswalks and relationship routes are the stable way to ask the same
    questions.

    Args:
        lookup_id (str): A lookup id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetAtlasLookupResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        lookup_id=lookup_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetAtlasLookupResponse200 | Problem | None:
    """Download a containment or lineage lookup the atlas reads

     The web atlas cannot hold the crosswalks, so the build reduces them to compact lookups for the
    boundary releases the atlas draws, as the geography resolver answers them. Available ids are `area-
    lineage` (where each ward, local authority and constituency goes between releases), `boundary-
    mappings` (each ward's local authority and constituency), `constituency-lad-overlaps` (the share of
    each constituency every local authority holds), `parish-lad-mappings` and `lsoa-lad-mappings-{year}`
    for each LSOA year the atlas draws, such as `lsoa-lad-mappings-2021`. Their shapes follow the atlas
    and may change with it; the crosswalks and relationship routes are the stable way to ask the same
    questions.

    Args:
        lookup_id (str): A lookup id, without the .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetAtlasLookupResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            lookup_id=lookup_id,
            client=client,
        )
    ).parsed
