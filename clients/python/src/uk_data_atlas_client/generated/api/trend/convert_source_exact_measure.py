from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.convert_source_exact_measure_geography import (
    ConvertSourceExactMeasureGeography,
)
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
    period: str,
    geography: ConvertSourceExactMeasureGeography,
    code_year: int,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["crosswalk"] = crosswalk

    params["path"] = path

    params["period"] = period

    json_geography = geography.value
    params["geography"] = json_geography

    params["codeYear"] = code_year

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/convert".format(
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
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
    period: str,
    geography: ConvertSourceExactMeasureGeography,
    code_year: int,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Regroup an extensive measure through a published crosswalk or relationship path

     Converts a source partition onto another geography or code vintage using the crosswalk, or the
    published relationship path, the caller names. Exactly one of `crosswalk` and `path` is required.
    The route never selects a conversion path: `GET /crosswalks` lists the published crosswalks and `GET
    /relationships` the published paths, and the response repeats each crosswalk's method, quality,
    weighting and content hash.

    A `path` carries values through every one of its steps in order, in the direction each step
    declares. Weights multiply along the path, so a source split at one step and split again at the next
    is apportioned by the product of the two published weights. A path is refused as a whole if any step
    would drop a value or split one without a weight.

    The crosswalk decides the target areas, so this route selects no geometry release: passing `release`
    is refused rather than ignored. Ask `/data/{measure-id}` with a compatible `release` to join
    geometry to source-exact values instead.
    Only a measure declared extensive may be converted, because conversion works by adding values up. An
    intensive measure is rejected: a share or a rank cannot be regrouped by summing, and weighting one
    by area produces a number with no meaning.
    The reported `method` distinguishes the outcomes. Across a path it describes every step together:
    `exact` only if no step splits a source, and `population-weighted` only if every splitting step is.
    `exact` means every source area sits wholly within one target, so the conversion is a regrouping and
    the partition total is unchanged. `area-weighted` means some sources were split in proportion to
    overlapping area, which is an estimate that assumes the measure is spread evenly across each source.
    `population-weighted` means they were split by where each source's residents live, counted from the
    crosswalk's population building blocks, which assumes the measure follows resident population.
    A source code the crosswalk does not carry, or a split source with no published weight, is rejected
    rather than partially converted.

    Args:
        measure_id (str):
        crosswalk (str | Unset):
        path (str | Unset):
        period (str):
        geography (ConvertSourceExactMeasureGeography):
        code_year (int):
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
        crosswalk=crosswalk,
        path=path,
        period=period,
        geography=geography,
        code_year=code_year,
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
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
    period: str,
    geography: ConvertSourceExactMeasureGeography,
    code_year: int,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Envelope | Problem | None:
    """Regroup an extensive measure through a published crosswalk or relationship path

     Converts a source partition onto another geography or code vintage using the crosswalk, or the
    published relationship path, the caller names. Exactly one of `crosswalk` and `path` is required.
    The route never selects a conversion path: `GET /crosswalks` lists the published crosswalks and `GET
    /relationships` the published paths, and the response repeats each crosswalk's method, quality,
    weighting and content hash.

    A `path` carries values through every one of its steps in order, in the direction each step
    declares. Weights multiply along the path, so a source split at one step and split again at the next
    is apportioned by the product of the two published weights. A path is refused as a whole if any step
    would drop a value or split one without a weight.

    The crosswalk decides the target areas, so this route selects no geometry release: passing `release`
    is refused rather than ignored. Ask `/data/{measure-id}` with a compatible `release` to join
    geometry to source-exact values instead.
    Only a measure declared extensive may be converted, because conversion works by adding values up. An
    intensive measure is rejected: a share or a rank cannot be regrouped by summing, and weighting one
    by area produces a number with no meaning.
    The reported `method` distinguishes the outcomes. Across a path it describes every step together:
    `exact` only if no step splits a source, and `population-weighted` only if every splitting step is.
    `exact` means every source area sits wholly within one target, so the conversion is a regrouping and
    the partition total is unchanged. `area-weighted` means some sources were split in proportion to
    overlapping area, which is an estimate that assumes the measure is spread evenly across each source.
    `population-weighted` means they were split by where each source's residents live, counted from the
    crosswalk's population building blocks, which assumes the measure follows resident population.
    A source code the crosswalk does not carry, or a split source with no published weight, is rejected
    rather than partially converted.

    Args:
        measure_id (str):
        crosswalk (str | Unset):
        path (str | Unset):
        period (str):
        geography (ConvertSourceExactMeasureGeography):
        code_year (int):
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
        crosswalk=crosswalk,
        path=path,
        period=period,
        geography=geography,
        code_year=code_year,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
    period: str,
    geography: ConvertSourceExactMeasureGeography,
    code_year: int,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Regroup an extensive measure through a published crosswalk or relationship path

     Converts a source partition onto another geography or code vintage using the crosswalk, or the
    published relationship path, the caller names. Exactly one of `crosswalk` and `path` is required.
    The route never selects a conversion path: `GET /crosswalks` lists the published crosswalks and `GET
    /relationships` the published paths, and the response repeats each crosswalk's method, quality,
    weighting and content hash.

    A `path` carries values through every one of its steps in order, in the direction each step
    declares. Weights multiply along the path, so a source split at one step and split again at the next
    is apportioned by the product of the two published weights. A path is refused as a whole if any step
    would drop a value or split one without a weight.

    The crosswalk decides the target areas, so this route selects no geometry release: passing `release`
    is refused rather than ignored. Ask `/data/{measure-id}` with a compatible `release` to join
    geometry to source-exact values instead.
    Only a measure declared extensive may be converted, because conversion works by adding values up. An
    intensive measure is rejected: a share or a rank cannot be regrouped by summing, and weighting one
    by area produces a number with no meaning.
    The reported `method` distinguishes the outcomes. Across a path it describes every step together:
    `exact` only if no step splits a source, and `population-weighted` only if every splitting step is.
    `exact` means every source area sits wholly within one target, so the conversion is a regrouping and
    the partition total is unchanged. `area-weighted` means some sources were split in proportion to
    overlapping area, which is an estimate that assumes the measure is spread evenly across each source.
    `population-weighted` means they were split by where each source's residents live, counted from the
    crosswalk's population building blocks, which assumes the measure follows resident population.
    A source code the crosswalk does not carry, or a split source with no published weight, is rejected
    rather than partially converted.

    Args:
        measure_id (str):
        crosswalk (str | Unset):
        path (str | Unset):
        period (str):
        geography (ConvertSourceExactMeasureGeography):
        code_year (int):
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
        crosswalk=crosswalk,
        path=path,
        period=period,
        geography=geography,
        code_year=code_year,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
    period: str,
    geography: ConvertSourceExactMeasureGeography,
    code_year: int,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Envelope | Problem | None:
    """Regroup an extensive measure through a published crosswalk or relationship path

     Converts a source partition onto another geography or code vintage using the crosswalk, or the
    published relationship path, the caller names. Exactly one of `crosswalk` and `path` is required.
    The route never selects a conversion path: `GET /crosswalks` lists the published crosswalks and `GET
    /relationships` the published paths, and the response repeats each crosswalk's method, quality,
    weighting and content hash.

    A `path` carries values through every one of its steps in order, in the direction each step
    declares. Weights multiply along the path, so a source split at one step and split again at the next
    is apportioned by the product of the two published weights. A path is refused as a whole if any step
    would drop a value or split one without a weight.

    The crosswalk decides the target areas, so this route selects no geometry release: passing `release`
    is refused rather than ignored. Ask `/data/{measure-id}` with a compatible `release` to join
    geometry to source-exact values instead.
    Only a measure declared extensive may be converted, because conversion works by adding values up. An
    intensive measure is rejected: a share or a rank cannot be regrouped by summing, and weighting one
    by area produces a number with no meaning.
    The reported `method` distinguishes the outcomes. Across a path it describes every step together:
    `exact` only if no step splits a source, and `population-weighted` only if every splitting step is.
    `exact` means every source area sits wholly within one target, so the conversion is a regrouping and
    the partition total is unchanged. `area-weighted` means some sources were split in proportion to
    overlapping area, which is an estimate that assumes the measure is spread evenly across each source.
    `population-weighted` means they were split by where each source's residents live, counted from the
    crosswalk's population building blocks, which assumes the measure follows resident population.
    A source code the crosswalk does not carry, or a split source with no published weight, is rejected
    rather than partially converted.

    Args:
        measure_id (str):
        crosswalk (str | Unset):
        path (str | Unset):
        period (str):
        geography (ConvertSourceExactMeasureGeography):
        code_year (int):
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
            crosswalk=crosswalk,
            path=path,
            period=period,
            geography=geography,
            code_year=code_year,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
