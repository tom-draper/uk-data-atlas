from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.ambiguous_place_problem import AmbiguousPlaceProblem
from ...models.envelope import Envelope
from ...models.get_source_exact_measure_series_geography import (
    GetSourceExactMeasureSeriesGeography,
)
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    place: str | Unset = UNSET,
    geography: GetSourceExactMeasureSeriesGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    to: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["place"] = place

    json_geography: str | Unset = UNSET
    if not isinstance(geography, Unset):
        json_geography = geography.value

    params["geography"] = json_geography

    params["codeYear"] = code_year

    params["to"] = to

    params["datasetId"] = dataset_id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/series".format(
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
    place: str | Unset = UNSET,
    geography: GetSourceExactMeasureSeriesGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    to: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Retrieve a source-exact or reviewed derived time series

     Returns all published observations for one area code within one source geography and code vintage.
    `place` accepts an area name, code or reference. With no source partition, the current published
    partition for that place is selected and returned as `defaults`. Without `to`, the result is source-
    exact: it does not select a boundary release, convert values or aggregate them. With `to`, the
    result is available only where the exact source partition has a reviewed conversion; every returned
    value is then labelled `derived` on that named frame. Supply `datasetId` when a measure has more
    than one source for the requested geography and boundary year.

    Args:
        measure_id (str):
        place (str | Unset):
        geography (GetSourceExactMeasureSeriesGeography | Unset):
        code_year (int | Unset):
        to (str | Unset):
        dataset_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        place=place,
        geography=geography,
        code_year=code_year,
        to=to,
        dataset_id=dataset_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    geography: GetSourceExactMeasureSeriesGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    to: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Retrieve a source-exact or reviewed derived time series

     Returns all published observations for one area code within one source geography and code vintage.
    `place` accepts an area name, code or reference. With no source partition, the current published
    partition for that place is selected and returned as `defaults`. Without `to`, the result is source-
    exact: it does not select a boundary release, convert values or aggregate them. With `to`, the
    result is available only where the exact source partition has a reviewed conversion; every returned
    value is then labelled `derived` on that named frame. Supply `datasetId` when a measure has more
    than one source for the requested geography and boundary year.

    Args:
        measure_id (str):
        place (str | Unset):
        geography (GetSourceExactMeasureSeriesGeography | Unset):
        code_year (int | Unset):
        to (str | Unset):
        dataset_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AmbiguousPlaceProblem | Envelope | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        place=place,
        geography=geography,
        code_year=code_year,
        to=to,
        dataset_id=dataset_id,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    geography: GetSourceExactMeasureSeriesGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    to: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Retrieve a source-exact or reviewed derived time series

     Returns all published observations for one area code within one source geography and code vintage.
    `place` accepts an area name, code or reference. With no source partition, the current published
    partition for that place is selected and returned as `defaults`. Without `to`, the result is source-
    exact: it does not select a boundary release, convert values or aggregate them. With `to`, the
    result is available only where the exact source partition has a reviewed conversion; every returned
    value is then labelled `derived` on that named frame. Supply `datasetId` when a measure has more
    than one source for the requested geography and boundary year.

    Args:
        measure_id (str):
        place (str | Unset):
        geography (GetSourceExactMeasureSeriesGeography | Unset):
        code_year (int | Unset):
        to (str | Unset):
        dataset_id (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        place=place,
        geography=geography,
        code_year=code_year,
        to=to,
        dataset_id=dataset_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    geography: GetSourceExactMeasureSeriesGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    to: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Retrieve a source-exact or reviewed derived time series

     Returns all published observations for one area code within one source geography and code vintage.
    `place` accepts an area name, code or reference. With no source partition, the current published
    partition for that place is selected and returned as `defaults`. Without `to`, the result is source-
    exact: it does not select a boundary release, convert values or aggregate them. With `to`, the
    result is available only where the exact source partition has a reviewed conversion; every returned
    value is then labelled `derived` on that named frame. Supply `datasetId` when a measure has more
    than one source for the requested geography and boundary year.

    Args:
        measure_id (str):
        place (str | Unset):
        geography (GetSourceExactMeasureSeriesGeography | Unset):
        code_year (int | Unset):
        to (str | Unset):
        dataset_id (str | Unset):

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
            place=place,
            geography=geography,
            code_year=code_year,
            to=to,
            dataset_id=dataset_id,
        )
    ).parsed
