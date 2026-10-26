from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.ambiguous_place_problem import AmbiguousPlaceProblem
from ...models.compare_source_exact_measure_areas_geography import (
    CompareSourceExactMeasureAreasGeography,
)
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    period: str | Unset = UNSET,
    geography: CompareSourceExactMeasureAreasGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    baseline_place: str,
    comparison_place: str,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["period"] = period

    json_geography: str | Unset = UNSET
    if not isinstance(geography, Unset):
        json_geography = geography.value

    params["geography"] = json_geography

    params["codeYear"] = code_year

    params["baselinePlace"] = baseline_place

    params["comparisonPlace"] = comparison_place

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/compare".format(
            measure_id=quote(str(measure_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    if response.status_code == 200:
        response_200 = Envelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = AmbiguousPlaceProblem.from_dict(response.json())

        return response_409

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
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
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
    geography: CompareSourceExactMeasureAreasGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    baseline_place: str,
    comparison_place: str,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Compare two areas within one source-exact measure partition

     Returns the comparison observation minus the baseline observation for one published period,
    geography and code vintage. Area codes may be replaced by unambiguous place names. Omitting source
    selectors uses the current published partition and latest period, recorded in `defaults`. The two
    named areas must be in the same source partition. Ratios report a difference on their source scale
    rather than a misleading relative change. The route does not select a boundary release, convert
    values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (CompareSourceExactMeasureAreasGeography | Unset):
        code_year (int | Unset):
        baseline_place (str):
        comparison_place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        period=period,
        geography=geography,
        code_year=code_year,
        baseline_place=baseline_place,
        comparison_place=comparison_place,
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
    geography: CompareSourceExactMeasureAreasGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    baseline_place: str,
    comparison_place: str,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Compare two areas within one source-exact measure partition

     Returns the comparison observation minus the baseline observation for one published period,
    geography and code vintage. Area codes may be replaced by unambiguous place names. Omitting source
    selectors uses the current published partition and latest period, recorded in `defaults`. The two
    named areas must be in the same source partition. Ratios report a difference on their source scale
    rather than a misleading relative change. The route does not select a boundary release, convert
    values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (CompareSourceExactMeasureAreasGeography | Unset):
        code_year (int | Unset):
        baseline_place (str):
        comparison_place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AmbiguousPlaceProblem | Envelope | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        period=period,
        geography=geography,
        code_year=code_year,
        baseline_place=baseline_place,
        comparison_place=comparison_place,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: CompareSourceExactMeasureAreasGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    baseline_place: str,
    comparison_place: str,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Compare two areas within one source-exact measure partition

     Returns the comparison observation minus the baseline observation for one published period,
    geography and code vintage. Area codes may be replaced by unambiguous place names. Omitting source
    selectors uses the current published partition and latest period, recorded in `defaults`. The two
    named areas must be in the same source partition. Ratios report a difference on their source scale
    rather than a misleading relative change. The route does not select a boundary release, convert
    values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (CompareSourceExactMeasureAreasGeography | Unset):
        code_year (int | Unset):
        baseline_place (str):
        comparison_place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        period=period,
        geography=geography,
        code_year=code_year,
        baseline_place=baseline_place,
        comparison_place=comparison_place,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: CompareSourceExactMeasureAreasGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    baseline_place: str,
    comparison_place: str,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Compare two areas within one source-exact measure partition

     Returns the comparison observation minus the baseline observation for one published period,
    geography and code vintage. Area codes may be replaced by unambiguous place names. Omitting source
    selectors uses the current published partition and latest period, recorded in `defaults`. The two
    named areas must be in the same source partition. Ratios report a difference on their source scale
    rather than a misleading relative change. The route does not select a boundary release, convert
    values or aggregate them.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (CompareSourceExactMeasureAreasGeography | Unset):
        code_year (int | Unset):
        baseline_place (str):
        comparison_place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AmbiguousPlaceProblem | Envelope | Problem
    """

    return (
        await asyncio_detailed(
            measure_id=measure_id,
            client=client,
            period=period,
            geography=geography,
            code_year=code_year,
            baseline_place=baseline_place,
            comparison_place=comparison_place,
        )
    ).parsed
