from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.list_measures_response_200 import ListMeasuresResponse200
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    q: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["q"] = q

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/measures",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ListMeasuresResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = ListMeasuresResponse200.from_dict(response.json())

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
) -> Response[ListMeasuresResponse200 | Problem]:
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
) -> Response[ListMeasuresResponse200 | Problem]:
    """List measures currently available to query

     Each measure retains its source-facing `unit` label and adds an API-owned `unitDefinition`.
    `unitDefinition.code` is the canonical unit, `scaleToCanonical` multiplies a published numeric value
    into that unit, and `per` names an explicit denominator when one is published. For example, `£
    million` is `GBP` with a scale of 1000000, and percent is `proportion` with a scale of 0.01. This is
    descriptive metadata only: observation values and source artifacts are not rewritten. `q` searches
    by the words people use: `population`, `house prices`, `deprivation`. Every measure whose id, alias,
    label or dataset title holds all of the query's words is listed, best first: an exact id or alias,
    then a match in the label, then in the id, then anywhere. A search never chooses one measure for the
    caller, and matching nothing is an empty list rather than a refusal. A measure's `aliases`, where it
    has any, are other names each naming it alone, accepted wherever its id is.

    Args:
        q (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListMeasuresResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        q=q,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
) -> ListMeasuresResponse200 | Problem | None:
    """List measures currently available to query

     Each measure retains its source-facing `unit` label and adds an API-owned `unitDefinition`.
    `unitDefinition.code` is the canonical unit, `scaleToCanonical` multiplies a published numeric value
    into that unit, and `per` names an explicit denominator when one is published. For example, `£
    million` is `GBP` with a scale of 1000000, and percent is `proportion` with a scale of 0.01. This is
    descriptive metadata only: observation values and source artifacts are not rewritten. `q` searches
    by the words people use: `population`, `house prices`, `deprivation`. Every measure whose id, alias,
    label or dataset title holds all of the query's words is listed, best first: an exact id or alias,
    then a match in the label, then in the id, then anywhere. A search never chooses one measure for the
    caller, and matching nothing is an empty list rather than a refusal. A measure's `aliases`, where it
    has any, are other names each naming it alone, accepted wherever its id is.

    Args:
        q (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListMeasuresResponse200 | Problem
    """

    return sync_detailed(
        client=client,
        q=q,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
) -> Response[ListMeasuresResponse200 | Problem]:
    """List measures currently available to query

     Each measure retains its source-facing `unit` label and adds an API-owned `unitDefinition`.
    `unitDefinition.code` is the canonical unit, `scaleToCanonical` multiplies a published numeric value
    into that unit, and `per` names an explicit denominator when one is published. For example, `£
    million` is `GBP` with a scale of 1000000, and percent is `proportion` with a scale of 0.01. This is
    descriptive metadata only: observation values and source artifacts are not rewritten. `q` searches
    by the words people use: `population`, `house prices`, `deprivation`. Every measure whose id, alias,
    label or dataset title holds all of the query's words is listed, best first: an exact id or alias,
    then a match in the label, then in the id, then anywhere. A search never chooses one measure for the
    caller, and matching nothing is an empty list rather than a refusal. A measure's `aliases`, where it
    has any, are other names each naming it alone, accepted wherever its id is.

    Args:
        q (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListMeasuresResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        q=q,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
) -> ListMeasuresResponse200 | Problem | None:
    """List measures currently available to query

     Each measure retains its source-facing `unit` label and adds an API-owned `unitDefinition`.
    `unitDefinition.code` is the canonical unit, `scaleToCanonical` multiplies a published numeric value
    into that unit, and `per` names an explicit denominator when one is published. For example, `£
    million` is `GBP` with a scale of 1000000, and percent is `proportion` with a scale of 0.01. This is
    descriptive metadata only: observation values and source artifacts are not rewritten. `q` searches
    by the words people use: `population`, `house prices`, `deprivation`. Every measure whose id, alias,
    label or dataset title holds all of the query's words is listed, best first: an exact id or alias,
    then a match in the label, then in the id, then anywhere. A search never chooses one measure for the
    caller, and matching nothing is an empty list rather than a refusal. A measure's `aliases`, where it
    has any, are other names each naming it alone, accepted wherever its id is.

    Args:
        q (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListMeasuresResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            q=q,
        )
    ).parsed
