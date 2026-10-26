from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.compare_boundary_releases_response_200 import (
    CompareBoundaryReleasesResponse200,
)
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    geography: str,
    from_: str,
    to: str,
    limit: int | Unset = 25,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["from"] = from_

    params["to"] = to

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/boundary-releases:compare",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CompareBoundaryReleasesResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = CompareBoundaryReleasesResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

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
) -> Response[CompareBoundaryReleasesResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    from_: str,
    to: str,
    limit: int | Unset = 25,
) -> Response[CompareBoundaryReleasesResponse200 | Problem]:
    """Compare two releases of one geography without inferring geography change from codes

     Compares the two compiled code sets, with identifiers present in only one release kept distinct from
    a claim that an area was added or removed. Shared codes are called continuous only where a published
    extent-continuity crosswalk measured their geometry. A code only one release holds is listed under
    `continuity.recoded` where that crosswalk found the same extent under a new code in the other. Its
    changed, indeterminate and unmeasured findings remain review evidence, not conversion claims. Other
    published crosswalks between the releases are named separately with their directional code
    cardinality and bounded split/merge-shaped examples. These describe published records, not a legal
    boundary-change finding, and need no runtime polygon comparison.

    Args:
        geography (str):
        from_ (str):
        to (str):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompareBoundaryReleasesResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        from_=from_,
        to=to,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    from_: str,
    to: str,
    limit: int | Unset = 25,
) -> CompareBoundaryReleasesResponse200 | Problem | None:
    """Compare two releases of one geography without inferring geography change from codes

     Compares the two compiled code sets, with identifiers present in only one release kept distinct from
    a claim that an area was added or removed. Shared codes are called continuous only where a published
    extent-continuity crosswalk measured their geometry. A code only one release holds is listed under
    `continuity.recoded` where that crosswalk found the same extent under a new code in the other. Its
    changed, indeterminate and unmeasured findings remain review evidence, not conversion claims. Other
    published crosswalks between the releases are named separately with their directional code
    cardinality and bounded split/merge-shaped examples. These describe published records, not a legal
    boundary-change finding, and need no runtime polygon comparison.

    Args:
        geography (str):
        from_ (str):
        to (str):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompareBoundaryReleasesResponse200 | Problem
    """

    return sync_detailed(
        client=client,
        geography=geography,
        from_=from_,
        to=to,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    from_: str,
    to: str,
    limit: int | Unset = 25,
) -> Response[CompareBoundaryReleasesResponse200 | Problem]:
    """Compare two releases of one geography without inferring geography change from codes

     Compares the two compiled code sets, with identifiers present in only one release kept distinct from
    a claim that an area was added or removed. Shared codes are called continuous only where a published
    extent-continuity crosswalk measured their geometry. A code only one release holds is listed under
    `continuity.recoded` where that crosswalk found the same extent under a new code in the other. Its
    changed, indeterminate and unmeasured findings remain review evidence, not conversion claims. Other
    published crosswalks between the releases are named separately with their directional code
    cardinality and bounded split/merge-shaped examples. These describe published records, not a legal
    boundary-change finding, and need no runtime polygon comparison.

    Args:
        geography (str):
        from_ (str):
        to (str):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompareBoundaryReleasesResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        from_=from_,
        to=to,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    from_: str,
    to: str,
    limit: int | Unset = 25,
) -> CompareBoundaryReleasesResponse200 | Problem | None:
    """Compare two releases of one geography without inferring geography change from codes

     Compares the two compiled code sets, with identifiers present in only one release kept distinct from
    a claim that an area was added or removed. Shared codes are called continuous only where a published
    extent-continuity crosswalk measured their geometry. A code only one release holds is listed under
    `continuity.recoded` where that crosswalk found the same extent under a new code in the other. Its
    changed, indeterminate and unmeasured findings remain review evidence, not conversion claims. Other
    published crosswalks between the releases are named separately with their directional code
    cardinality and bounded split/merge-shaped examples. These describe published records, not a legal
    boundary-change finding, and need no runtime polygon comparison.

    Args:
        geography (str):
        from_ (str):
        to (str):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompareBoundaryReleasesResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            geography=geography,
            from_=from_,
            to=to,
            limit=limit,
        )
    ).parsed
