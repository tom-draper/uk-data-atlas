from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.crosswalk_record_list_envelope import CrosswalkRecordListEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    crosswalk_id: str,
    *,
    source: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["source"] = source

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/crosswalks/{crosswalk_id}/records".format(
            crosswalk_id=quote(str(crosswalk_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CrosswalkRecordListEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = CrosswalkRecordListEnvelope.from_dict(response.json())

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
) -> Response[CrosswalkRecordListEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    source: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[CrosswalkRecordListEnvelope | Problem]:
    """List (optionally filtered) records for one crosswalk

    Args:
        crosswalk_id (str):
        source (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CrosswalkRecordListEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        crosswalk_id=crosswalk_id,
        source=source,
        limit=limit,
        cursor=cursor,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    source: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> CrosswalkRecordListEnvelope | Problem | None:
    """List (optionally filtered) records for one crosswalk

    Args:
        crosswalk_id (str):
        source (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CrosswalkRecordListEnvelope | Problem
    """

    return sync_detailed(
        crosswalk_id=crosswalk_id,
        client=client,
        source=source,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    source: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[CrosswalkRecordListEnvelope | Problem]:
    """List (optionally filtered) records for one crosswalk

    Args:
        crosswalk_id (str):
        source (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CrosswalkRecordListEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        crosswalk_id=crosswalk_id,
        source=source,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    source: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> CrosswalkRecordListEnvelope | Problem | None:
    """List (optionally filtered) records for one crosswalk

    Args:
        crosswalk_id (str):
        source (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CrosswalkRecordListEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            crosswalk_id=crosswalk_id,
            client=client,
            source=source,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
