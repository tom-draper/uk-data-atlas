from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_area_history_response_200 import GetAreaHistoryResponse200
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    depth: int | Unset = 8,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["depth"] = depth

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/history".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetAreaHistoryResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetAreaHistoryResponse200.from_dict(response.json())

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
) -> Response[GetAreaHistoryResponse200 | Problem]:
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
    depth: int | Unset = 8,
) -> Response[GetAreaHistoryResponse200 | Problem]:
    """Explain a code's published historical relationships and same-code continuity

     Returns a bounded traversal of published historical relationships plus every other release of the
    same geography that contains the same code. Each lineage entry names the area the walk stood on as
    `from` and the area it reached as `counterpart`. A link a crosswalk publishes from both ends is one
    edge and is reported once, whichever end the walk reaches it from. Same-code continuity is not
    evidence of unchanged geometry or a one-to-one historical equivalent.

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):  Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetAreaHistoryResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        depth=depth,
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
    depth: int | Unset = 8,
) -> GetAreaHistoryResponse200 | Problem | None:
    """Explain a code's published historical relationships and same-code continuity

     Returns a bounded traversal of published historical relationships plus every other release of the
    same geography that contains the same code. Each lineage entry names the area the walk stood on as
    `from` and the area it reached as `counterpart`. A link a crosswalk publishes from both ends is one
    edge and is reported once, whichever end the walk reaches it from. Same-code continuity is not
    evidence of unchanged geometry or a one-to-one historical equivalent.

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):  Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetAreaHistoryResponse200 | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        depth=depth,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    depth: int | Unset = 8,
) -> Response[GetAreaHistoryResponse200 | Problem]:
    """Explain a code's published historical relationships and same-code continuity

     Returns a bounded traversal of published historical relationships plus every other release of the
    same geography that contains the same code. Each lineage entry names the area the walk stood on as
    `from` and the area it reached as `counterpart`. A link a crosswalk publishes from both ends is one
    edge and is reported once, whichever end the walk reaches it from. Same-code continuity is not
    evidence of unchanged geometry or a one-to-one historical equivalent.

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):  Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetAreaHistoryResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        depth=depth,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    depth: int | Unset = 8,
) -> GetAreaHistoryResponse200 | Problem | None:
    """Explain a code's published historical relationships and same-code continuity

     Returns a bounded traversal of published historical relationships plus every other release of the
    same geography that contains the same code. Each lineage entry names the area the walk stood on as
    `from` and the area it reached as `counterpart`. A link a crosswalk publishes from both ends is one
    edge and is reported once, whichever end the walk reaches it from. Same-code continuity is not
    evidence of unchanged geometry or a one-to-one historical equivalent.

    Args:
        geography (str):
        release (str):
        code (str):
        depth (int | Unset):  Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetAreaHistoryResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            depth=depth,
        )
    ).parsed
