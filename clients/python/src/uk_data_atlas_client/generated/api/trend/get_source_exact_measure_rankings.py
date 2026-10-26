from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.get_source_exact_measure_rankings_geography import (
    GetSourceExactMeasureRankingsGeography,
)
from ...models.get_source_exact_measure_rankings_order import (
    GetSourceExactMeasureRankingsOrder,
)
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    period: str | Unset = UNSET,
    geography: GetSourceExactMeasureRankingsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    order: GetSourceExactMeasureRankingsOrder
    | Unset = GetSourceExactMeasureRankingsOrder.DESC,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["period"] = period

    json_geography: str | Unset = UNSET
    if not isinstance(geography, Unset):
        json_geography = geography.value

    params["geography"] = json_geography

    params["codeYear"] = code_year

    json_order: str | Unset = UNSET
    if not isinstance(order, Unset):
        json_order = order.value

    params["order"] = json_order

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/rankings".format(
            measure_id=quote(str(measure_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Envelope | Problem | None:
    if response.status_code == 200:
        response_200 = Envelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 422:
        response_422 = Problem.from_dict(response.json())

        return response_422

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Envelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetSourceExactMeasureRankingsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    order: GetSourceExactMeasureRankingsOrder
    | Unset = GetSourceExactMeasureRankingsOrder.DESC,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Rank areas within one source-exact measure partition

     Ranks only the observations published for one period, geography and code vintage. Omitting any of
    those selects the current published partition and latest period, recorded in `defaults`. Uses
    competition ranking: tied values share a rank and the following rank accounts for all preceding
    observations (1, 1, 3). It does not select a boundary release, convert values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetSourceExactMeasureRankingsGeography | Unset):
        code_year (int | Unset):
        order (GetSourceExactMeasureRankingsOrder | Unset):  Default:
            GetSourceExactMeasureRankingsOrder.DESC.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        period=period,
        geography=geography,
        code_year=code_year,
        order=order,
        limit=limit,
        cursor=cursor,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetSourceExactMeasureRankingsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    order: GetSourceExactMeasureRankingsOrder
    | Unset = GetSourceExactMeasureRankingsOrder.DESC,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Envelope | Problem | None:
    """Rank areas within one source-exact measure partition

     Ranks only the observations published for one period, geography and code vintage. Omitting any of
    those selects the current published partition and latest period, recorded in `defaults`. Uses
    competition ranking: tied values share a rank and the following rank accounts for all preceding
    observations (1, 1, 3). It does not select a boundary release, convert values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetSourceExactMeasureRankingsGeography | Unset):
        code_year (int | Unset):
        order (GetSourceExactMeasureRankingsOrder | Unset):  Default:
            GetSourceExactMeasureRankingsOrder.DESC.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        period=period,
        geography=geography,
        code_year=code_year,
        order=order,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetSourceExactMeasureRankingsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    order: GetSourceExactMeasureRankingsOrder
    | Unset = GetSourceExactMeasureRankingsOrder.DESC,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Rank areas within one source-exact measure partition

     Ranks only the observations published for one period, geography and code vintage. Omitting any of
    those selects the current published partition and latest period, recorded in `defaults`. Uses
    competition ranking: tied values share a rank and the following rank accounts for all preceding
    observations (1, 1, 3). It does not select a boundary release, convert values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetSourceExactMeasureRankingsGeography | Unset):
        code_year (int | Unset):
        order (GetSourceExactMeasureRankingsOrder | Unset):  Default:
            GetSourceExactMeasureRankingsOrder.DESC.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        period=period,
        geography=geography,
        code_year=code_year,
        order=order,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetSourceExactMeasureRankingsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    order: GetSourceExactMeasureRankingsOrder
    | Unset = GetSourceExactMeasureRankingsOrder.DESC,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Envelope | Problem | None:
    """Rank areas within one source-exact measure partition

     Ranks only the observations published for one period, geography and code vintage. Omitting any of
    those selects the current published partition and latest period, recorded in `defaults`. Uses
    competition ranking: tied values share a rank and the following rank accounts for all preceding
    observations (1, 1, 3). It does not select a boundary release, convert values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetSourceExactMeasureRankingsGeography | Unset):
        code_year (int | Unset):
        order (GetSourceExactMeasureRankingsOrder | Unset):  Default:
            GetSourceExactMeasureRankingsOrder.DESC.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            measure_id=measure_id,
            client=client,
            period=period,
            geography=geography,
            code_year=code_year,
            order=order,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
