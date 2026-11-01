from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_measure_response_200 import GetMeasureResponse200
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    measure_id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/measures/{measure_id}".format(
            measure_id=quote(str(measure_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetMeasureResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetMeasureResponse200.from_dict(response.json())

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
) -> Response[GetMeasureResponse200 | Problem]:
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
) -> Response[GetMeasureResponse200 | Problem]:
    """Get one measure's semantics and availability

     A measure's definition: what it counts, the unit, whether it may be summed or averaged, and which
    source partitions publish it with what national coverage.

    `unit` remains the published display label. `unitDefinition` supplies an API-owned canonical code,
    scale and (where applicable) denominator for safe unit-aware calculations; it never changes the
    source artifact or an observation value.

    Where another nation publishes its own answer to the same question, the measure carries `concept`
    and `elsewhere`. Each entry in `elsewhere` names that measure, the countries it covers, and whether
    the two are `comparable`. For the four national deprivation indices they are not: each ranks its own
    nation's areas from 1 against its own domains and weights, so they cannot be put on one scale. The
    reason travels with the link rather than living in documentation, because the numbers themselves
    give no sign of it.

    Args:
        measure_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetMeasureResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetMeasureResponse200 | Problem | None:
    """Get one measure's semantics and availability

     A measure's definition: what it counts, the unit, whether it may be summed or averaged, and which
    source partitions publish it with what national coverage.

    `unit` remains the published display label. `unitDefinition` supplies an API-owned canonical code,
    scale and (where applicable) denominator for safe unit-aware calculations; it never changes the
    source artifact or an observation value.

    Where another nation publishes its own answer to the same question, the measure carries `concept`
    and `elsewhere`. Each entry in `elsewhere` names that measure, the countries it covers, and whether
    the two are `comparable`. For the four national deprivation indices they are not: each ranks its own
    nation's areas from 1 against its own domains and weights, so they cannot be put on one scale. The
    reason travels with the link rather than living in documentation, because the numbers themselves
    give no sign of it.

    Args:
        measure_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetMeasureResponse200 | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetMeasureResponse200 | Problem]:
    """Get one measure's semantics and availability

     A measure's definition: what it counts, the unit, whether it may be summed or averaged, and which
    source partitions publish it with what national coverage.

    `unit` remains the published display label. `unitDefinition` supplies an API-owned canonical code,
    scale and (where applicable) denominator for safe unit-aware calculations; it never changes the
    source artifact or an observation value.

    Where another nation publishes its own answer to the same question, the measure carries `concept`
    and `elsewhere`. Each entry in `elsewhere` names that measure, the countries it covers, and whether
    the two are `comparable`. For the four national deprivation indices they are not: each ranks its own
    nation's areas from 1 against its own domains and weights, so they cannot be put on one scale. The
    reason travels with the link rather than living in documentation, because the numbers themselves
    give no sign of it.

    Args:
        measure_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetMeasureResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetMeasureResponse200 | Problem | None:
    """Get one measure's semantics and availability

     A measure's definition: what it counts, the unit, whether it may be summed or averaged, and which
    source partitions publish it with what national coverage.

    `unit` remains the published display label. `unitDefinition` supplies an API-owned canonical code,
    scale and (where applicable) denominator for safe unit-aware calculations; it never changes the
    source artifact or an observation value.

    Where another nation publishes its own answer to the same question, the measure carries `concept`
    and `elsewhere`. Each entry in `elsewhere` names that measure, the countries it covers, and whether
    the two are `comparable`. For the four national deprivation indices they are not: each ranks its own
    nation's areas from 1 against its own domains and weights, so they cannot be put on one scale. The
    reason travels with the link rather than living in documentation, because the numbers themselves
    give no sign of it.

    Args:
        measure_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetMeasureResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            measure_id=measure_id,
            client=client,
        )
    ).parsed
