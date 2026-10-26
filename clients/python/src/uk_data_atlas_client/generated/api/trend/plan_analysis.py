from http import HTTPStatus
from typing import Any, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...types import UNSET, Response


def _get_kwargs(
    *,
    measure: str,
    period: str,
    to: str,
    geography: str,
    code_year: int,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["measure"] = measure

    params["period"] = period

    params["to"] = to

    params["geography"] = geography

    params["codeYear"] = code_year

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/analysis:plan",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | Problem | None:
    if response.status_code == 200:
        response_200 = cast(Any, None)
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
) -> Response[Any | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    measure: str,
    period: str,
    to: str,
    geography: str,
    code_year: int,
) -> Response[Any | Problem]:
    """Preflight a reviewed source-to-analysis conversion

     Returns a plan only: the selected source partition, the published crosswalk and whether the
    requested period is comparable on the named analysis frame. It also states the measure's aggregation
    rule, country-by-country coverage and expected output size, and carries the ranked conversion-plan
    evidence where that catalogue is available. `saferAlternatives` always includes the source-exact
    route, so a caller can keep the publisher's partition when conversion is unnecessary. It does not
    fetch or transform observations.

    Args:
        measure (str):
        period (str):
        to (str):
        geography (str):
        code_year (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
    """

    kwargs = _get_kwargs(
        measure=measure,
        period=period,
        to=to,
        geography=geography,
        code_year=code_year,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    measure: str,
    period: str,
    to: str,
    geography: str,
    code_year: int,
) -> Any | Problem | None:
    """Preflight a reviewed source-to-analysis conversion

     Returns a plan only: the selected source partition, the published crosswalk and whether the
    requested period is comparable on the named analysis frame. It also states the measure's aggregation
    rule, country-by-country coverage and expected output size, and carries the ranked conversion-plan
    evidence where that catalogue is available. `saferAlternatives` always includes the source-exact
    route, so a caller can keep the publisher's partition when conversion is unnecessary. It does not
    fetch or transform observations.

    Args:
        measure (str):
        period (str):
        to (str):
        geography (str):
        code_year (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
    """

    return sync_detailed(
        client=client,
        measure=measure,
        period=period,
        to=to,
        geography=geography,
        code_year=code_year,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    measure: str,
    period: str,
    to: str,
    geography: str,
    code_year: int,
) -> Response[Any | Problem]:
    """Preflight a reviewed source-to-analysis conversion

     Returns a plan only: the selected source partition, the published crosswalk and whether the
    requested period is comparable on the named analysis frame. It also states the measure's aggregation
    rule, country-by-country coverage and expected output size, and carries the ranked conversion-plan
    evidence where that catalogue is available. `saferAlternatives` always includes the source-exact
    route, so a caller can keep the publisher's partition when conversion is unnecessary. It does not
    fetch or transform observations.

    Args:
        measure (str):
        period (str):
        to (str):
        geography (str):
        code_year (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
    """

    kwargs = _get_kwargs(
        measure=measure,
        period=period,
        to=to,
        geography=geography,
        code_year=code_year,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    measure: str,
    period: str,
    to: str,
    geography: str,
    code_year: int,
) -> Any | Problem | None:
    """Preflight a reviewed source-to-analysis conversion

     Returns a plan only: the selected source partition, the published crosswalk and whether the
    requested period is comparable on the named analysis frame. It also states the measure's aggregation
    rule, country-by-country coverage and expected output size, and carries the ranked conversion-plan
    evidence where that catalogue is available. `saferAlternatives` always includes the source-exact
    route, so a caller can keep the publisher's partition when conversion is unnecessary. It does not
    fetch or transform observations.

    Args:
        measure (str):
        period (str):
        to (str):
        geography (str):
        code_year (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            measure=measure,
            period=period,
            to=to,
            geography=geography,
            code_year=code_year,
        )
    ).parsed
