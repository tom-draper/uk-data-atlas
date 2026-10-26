from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.ambiguous_place_problem import AmbiguousPlaceProblem
from ...models.envelope import Envelope
from ...models.get_source_exact_measure_change_by import GetSourceExactMeasureChangeBy
from ...models.get_source_exact_measure_change_order import (
    GetSourceExactMeasureChangeOrder,
)
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    geography: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    start_period: str | Unset = UNSET,
    end_period: str | Unset = UNSET,
    by: GetSourceExactMeasureChangeBy | Unset = GetSourceExactMeasureChangeBy.ABSOLUTE,
    order: GetSourceExactMeasureChangeOrder
    | Unset = GetSourceExactMeasureChangeOrder.DESC,
    place: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["codeYear"] = code_year

    params["startPeriod"] = start_period

    params["endPeriod"] = end_period

    json_by: str | Unset = UNSET
    if not isinstance(by, Unset):
        json_by = by.value

    params["by"] = json_by

    json_order: str | Unset = UNSET
    if not isinstance(order, Unset):
        json_order = order.value

    params["order"] = json_order

    params["place"] = place

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/change".format(
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
    geography: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    start_period: str | Unset = UNSET,
    end_period: str | Unset = UNSET,
    by: GetSourceExactMeasureChangeBy | Unset = GetSourceExactMeasureChangeBy.ABSOLUTE,
    order: GetSourceExactMeasureChangeOrder
    | Unset = GetSourceExactMeasureChangeOrder.DESC,
    place: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Rank areas by change between two periods of one measure partition

     Returns how each area changed between two periods, ranked: the question "where did population grow
    fastest between 2011 and 2022?" Pass `place` for one area, which keeps its rank among all of them,
    so "Manchester grew 13.2%, 42nd of 361" is a single call.

    Change is measured inside one source partition, never across two. The publisher restates every
    period of a partition on a single set of codes, so an area code names the same ground at the start
    and the end. Pairing periods from partitions on different codes would pair areas that are not the
    same place, so it is not offered. A partition that cannot be chosen returns a 400 listing the
    partitions and how many periods each has.

    The geography may be left out when `place` names an area, by name or code, or the measure is
    published on one geography. The boundary year and periods may be left out too: the newest partition
    is used, ending at its latest period and starting at the latest one before the end that does not
    overlap it. What was chosen is returned in `defaults`.

    `by=absolute` ranks the end value less the start, in the measure's unit. `by=relative` ranks that as
    a proportion of the start, and is refused for a ratio: change in a share is read in points, and a
    rise in coverage from 2% to 3% is not usefully called 50%. An area whose start is zero has no
    relative change and is left out of a relative ranking, counted in `coverage.withoutRelativeChange`.
    Currency is nominal and not adjusted for inflation.

    Some changes are refused outright. A rank or decile is a position among the other areas rather than
    a quantity, so a move in it is not change in the area. A partition publishing one period has nothing
    to change between. Rolling windows that share years, such as life expectancy for 2017-2019 and
    2018-2020, are refused because most of the apparent change is the same data counted twice.

    Where the publisher gives intervals, each record says whether the start and end intervals overlap.
    Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do
    not show that it is. Areas with a value in only one period are listed in `coverage.onlyAtStart` and
    `coverage.onlyAtEnd` rather than paired with anything.

    Args:
        measure_id (str):
        geography (str | Unset):
        code_year (int | Unset):
        start_period (str | Unset):
        end_period (str | Unset):
        by (GetSourceExactMeasureChangeBy | Unset):  Default:
            GetSourceExactMeasureChangeBy.ABSOLUTE.
        order (GetSourceExactMeasureChangeOrder | Unset):  Default:
            GetSourceExactMeasureChangeOrder.DESC.
        place (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        geography=geography,
        code_year=code_year,
        start_period=start_period,
        end_period=end_period,
        by=by,
        order=order,
        place=place,
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
    geography: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    start_period: str | Unset = UNSET,
    end_period: str | Unset = UNSET,
    by: GetSourceExactMeasureChangeBy | Unset = GetSourceExactMeasureChangeBy.ABSOLUTE,
    order: GetSourceExactMeasureChangeOrder
    | Unset = GetSourceExactMeasureChangeOrder.DESC,
    place: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Rank areas by change between two periods of one measure partition

     Returns how each area changed between two periods, ranked: the question "where did population grow
    fastest between 2011 and 2022?" Pass `place` for one area, which keeps its rank among all of them,
    so "Manchester grew 13.2%, 42nd of 361" is a single call.

    Change is measured inside one source partition, never across two. The publisher restates every
    period of a partition on a single set of codes, so an area code names the same ground at the start
    and the end. Pairing periods from partitions on different codes would pair areas that are not the
    same place, so it is not offered. A partition that cannot be chosen returns a 400 listing the
    partitions and how many periods each has.

    The geography may be left out when `place` names an area, by name or code, or the measure is
    published on one geography. The boundary year and periods may be left out too: the newest partition
    is used, ending at its latest period and starting at the latest one before the end that does not
    overlap it. What was chosen is returned in `defaults`.

    `by=absolute` ranks the end value less the start, in the measure's unit. `by=relative` ranks that as
    a proportion of the start, and is refused for a ratio: change in a share is read in points, and a
    rise in coverage from 2% to 3% is not usefully called 50%. An area whose start is zero has no
    relative change and is left out of a relative ranking, counted in `coverage.withoutRelativeChange`.
    Currency is nominal and not adjusted for inflation.

    Some changes are refused outright. A rank or decile is a position among the other areas rather than
    a quantity, so a move in it is not change in the area. A partition publishing one period has nothing
    to change between. Rolling windows that share years, such as life expectancy for 2017-2019 and
    2018-2020, are refused because most of the apparent change is the same data counted twice.

    Where the publisher gives intervals, each record says whether the start and end intervals overlap.
    Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do
    not show that it is. Areas with a value in only one period are listed in `coverage.onlyAtStart` and
    `coverage.onlyAtEnd` rather than paired with anything.

    Args:
        measure_id (str):
        geography (str | Unset):
        code_year (int | Unset):
        start_period (str | Unset):
        end_period (str | Unset):
        by (GetSourceExactMeasureChangeBy | Unset):  Default:
            GetSourceExactMeasureChangeBy.ABSOLUTE.
        order (GetSourceExactMeasureChangeOrder | Unset):  Default:
            GetSourceExactMeasureChangeOrder.DESC.
        place (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AmbiguousPlaceProblem | Envelope | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        geography=geography,
        code_year=code_year,
        start_period=start_period,
        end_period=end_period,
        by=by,
        order=order,
        place=place,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    start_period: str | Unset = UNSET,
    end_period: str | Unset = UNSET,
    by: GetSourceExactMeasureChangeBy | Unset = GetSourceExactMeasureChangeBy.ABSOLUTE,
    order: GetSourceExactMeasureChangeOrder
    | Unset = GetSourceExactMeasureChangeOrder.DESC,
    place: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Rank areas by change between two periods of one measure partition

     Returns how each area changed between two periods, ranked: the question "where did population grow
    fastest between 2011 and 2022?" Pass `place` for one area, which keeps its rank among all of them,
    so "Manchester grew 13.2%, 42nd of 361" is a single call.

    Change is measured inside one source partition, never across two. The publisher restates every
    period of a partition on a single set of codes, so an area code names the same ground at the start
    and the end. Pairing periods from partitions on different codes would pair areas that are not the
    same place, so it is not offered. A partition that cannot be chosen returns a 400 listing the
    partitions and how many periods each has.

    The geography may be left out when `place` names an area, by name or code, or the measure is
    published on one geography. The boundary year and periods may be left out too: the newest partition
    is used, ending at its latest period and starting at the latest one before the end that does not
    overlap it. What was chosen is returned in `defaults`.

    `by=absolute` ranks the end value less the start, in the measure's unit. `by=relative` ranks that as
    a proportion of the start, and is refused for a ratio: change in a share is read in points, and a
    rise in coverage from 2% to 3% is not usefully called 50%. An area whose start is zero has no
    relative change and is left out of a relative ranking, counted in `coverage.withoutRelativeChange`.
    Currency is nominal and not adjusted for inflation.

    Some changes are refused outright. A rank or decile is a position among the other areas rather than
    a quantity, so a move in it is not change in the area. A partition publishing one period has nothing
    to change between. Rolling windows that share years, such as life expectancy for 2017-2019 and
    2018-2020, are refused because most of the apparent change is the same data counted twice.

    Where the publisher gives intervals, each record says whether the start and end intervals overlap.
    Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do
    not show that it is. Areas with a value in only one period are listed in `coverage.onlyAtStart` and
    `coverage.onlyAtEnd` rather than paired with anything.

    Args:
        measure_id (str):
        geography (str | Unset):
        code_year (int | Unset):
        start_period (str | Unset):
        end_period (str | Unset):
        by (GetSourceExactMeasureChangeBy | Unset):  Default:
            GetSourceExactMeasureChangeBy.ABSOLUTE.
        order (GetSourceExactMeasureChangeOrder | Unset):  Default:
            GetSourceExactMeasureChangeOrder.DESC.
        place (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        geography=geography,
        code_year=code_year,
        start_period=start_period,
        end_period=end_period,
        by=by,
        order=order,
        place=place,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    start_period: str | Unset = UNSET,
    end_period: str | Unset = UNSET,
    by: GetSourceExactMeasureChangeBy | Unset = GetSourceExactMeasureChangeBy.ABSOLUTE,
    order: GetSourceExactMeasureChangeOrder
    | Unset = GetSourceExactMeasureChangeOrder.DESC,
    place: str | Unset = UNSET,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Rank areas by change between two periods of one measure partition

     Returns how each area changed between two periods, ranked: the question "where did population grow
    fastest between 2011 and 2022?" Pass `place` for one area, which keeps its rank among all of them,
    so "Manchester grew 13.2%, 42nd of 361" is a single call.

    Change is measured inside one source partition, never across two. The publisher restates every
    period of a partition on a single set of codes, so an area code names the same ground at the start
    and the end. Pairing periods from partitions on different codes would pair areas that are not the
    same place, so it is not offered. A partition that cannot be chosen returns a 400 listing the
    partitions and how many periods each has.

    The geography may be left out when `place` names an area, by name or code, or the measure is
    published on one geography. The boundary year and periods may be left out too: the newest partition
    is used, ending at its latest period and starting at the latest one before the end that does not
    overlap it. What was chosen is returned in `defaults`.

    `by=absolute` ranks the end value less the start, in the measure's unit. `by=relative` ranks that as
    a proportion of the start, and is refused for a ratio: change in a share is read in points, and a
    rise in coverage from 2% to 3% is not usefully called 50%. An area whose start is zero has no
    relative change and is left out of a relative ranking, counted in `coverage.withoutRelativeChange`.
    Currency is nominal and not adjusted for inflation.

    Some changes are refused outright. A rank or decile is a position among the other areas rather than
    a quantity, so a move in it is not change in the area. A partition publishing one period has nothing
    to change between. Rolling windows that share years, such as life expectancy for 2017-2019 and
    2018-2020, are refused because most of the apparent change is the same data counted twice.

    Where the publisher gives intervals, each record says whether the start and end intervals overlap.
    Intervals that do not overlap mean the change is unlikely to be chance; intervals that do overlap do
    not show that it is. Areas with a value in only one period are listed in `coverage.onlyAtStart` and
    `coverage.onlyAtEnd` rather than paired with anything.

    Args:
        measure_id (str):
        geography (str | Unset):
        code_year (int | Unset):
        start_period (str | Unset):
        end_period (str | Unset):
        by (GetSourceExactMeasureChangeBy | Unset):  Default:
            GetSourceExactMeasureChangeBy.ABSOLUTE.
        order (GetSourceExactMeasureChangeOrder | Unset):  Default:
            GetSourceExactMeasureChangeOrder.DESC.
        place (str | Unset):
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

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
            geography=geography,
            code_year=code_year,
            start_period=start_period,
            end_period=end_period,
            by=by,
            order=order,
            place=place,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
