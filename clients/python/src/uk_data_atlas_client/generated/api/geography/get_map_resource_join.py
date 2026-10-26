from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_map_resource_join_format import GetMapResourceJoinFormat
from ...models.incompatible_geometry_problem import IncompatibleGeometryProblem
from ...models.map_join_budget_problem import MapJoinBudgetProblem
from ...models.map_resource_join_envelope import MapResourceJoinEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography_path: str,
    release: str,
    measure_id: str,
    *,
    period: str,
    geography_query: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    format_: GetMapResourceJoinFormat | Unset = GetMapResourceJoinFormat.JSON,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["period"] = period

    params["geography"] = geography_query

    params["codeYear"] = code_year

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/map-resources/{geography_path}/{release}/join/{measure_id}".format(
            geography_path=quote(str(geography_path), safe=""),
            release=quote(str(release), safe=""),
            measure_id=quote(str(measure_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    IncompatibleGeometryProblem
    | MapJoinBudgetProblem
    | MapResourceJoinEnvelope
    | Problem
    | None
):
    if response.status_code == 200:
        response_200 = MapResourceJoinEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 422:

        def _parse_response_422(
            data: object,
        ) -> IncompatibleGeometryProblem | MapJoinBudgetProblem:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                response_422_type_0 = IncompatibleGeometryProblem.from_dict(data)

                return response_422_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            response_422_type_1 = MapJoinBudgetProblem.from_dict(data)

            return response_422_type_1

        response_422 = _parse_response_422(response.json())

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
) -> Response[
    IncompatibleGeometryProblem
    | MapJoinBudgetProblem
    | MapResourceJoinEnvelope
    | Problem
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    geography_path: str,
    release: str,
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str,
    geography_query: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    format_: GetMapResourceJoinFormat | Unset = GetMapResourceJoinFormat.JSON,
) -> Response[
    IncompatibleGeometryProblem
    | MapJoinBudgetProblem
    | MapResourceJoinEnvelope
    | Problem
]:
    """One measure's values, numbered to match this resource's tiles

     The values a renderer joins to the tiles, as `id`, `code` and `value`. The `id` is the same integer
    the tile carries, so a renderer sets feature state by it without reading the geometry. Values are
    joined to this release by matching area code and are never converted: a measure whose source codes
    are not all in this release is refused with `incompatible_geometry`, and the refusal names the
    releases that would carry it. Keeping values out of the tiles is what lets one tileset serve every
    measure, and lets a corrected value invalidate a small table rather than a whole pyramid.

    With `format=parquet` the same table is served as a Parquet file with `id`, `code`, `value` and
    `status` columns, for a warehouse to join to the GeoParquet `features`. Everything the JSON envelope
    says about the table, from the Atlas release to the join rule and provenance, travels in the file's
    `uk-data-atlas` metadata.
    Both formats accept at most 250,000 source records and 16 MiB of uncompressed column payload. The
    byte budget counts 20 bytes per numeric row for id, value and string-length prefixes, plus the UTF-8
    code and status bytes. Oversized joins return `422 Map Join Budget Exceeded` before output rows or
    columns are built, with no partial table and a `links.data` URL for paginated source observations.
    Source artifact parsing and record materialisation occur before this check; this is not a heap or
    RSS ceiling.

    Args:
        geography_path (str):
        release (str):
        measure_id (str):
        period (str):
        geography_query (str | Unset):
        code_year (int | Unset):
        format_ (GetMapResourceJoinFormat | Unset):  Default: GetMapResourceJoinFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[IncompatibleGeometryProblem | MapJoinBudgetProblem | MapResourceJoinEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography_path=geography_path,
        release=release,
        measure_id=measure_id,
        period=period,
        geography_query=geography_query,
        code_year=code_year,
        format_=format_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography_path: str,
    release: str,
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str,
    geography_query: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    format_: GetMapResourceJoinFormat | Unset = GetMapResourceJoinFormat.JSON,
) -> (
    IncompatibleGeometryProblem
    | MapJoinBudgetProblem
    | MapResourceJoinEnvelope
    | Problem
    | None
):
    """One measure's values, numbered to match this resource's tiles

     The values a renderer joins to the tiles, as `id`, `code` and `value`. The `id` is the same integer
    the tile carries, so a renderer sets feature state by it without reading the geometry. Values are
    joined to this release by matching area code and are never converted: a measure whose source codes
    are not all in this release is refused with `incompatible_geometry`, and the refusal names the
    releases that would carry it. Keeping values out of the tiles is what lets one tileset serve every
    measure, and lets a corrected value invalidate a small table rather than a whole pyramid.

    With `format=parquet` the same table is served as a Parquet file with `id`, `code`, `value` and
    `status` columns, for a warehouse to join to the GeoParquet `features`. Everything the JSON envelope
    says about the table, from the Atlas release to the join rule and provenance, travels in the file's
    `uk-data-atlas` metadata.
    Both formats accept at most 250,000 source records and 16 MiB of uncompressed column payload. The
    byte budget counts 20 bytes per numeric row for id, value and string-length prefixes, plus the UTF-8
    code and status bytes. Oversized joins return `422 Map Join Budget Exceeded` before output rows or
    columns are built, with no partial table and a `links.data` URL for paginated source observations.
    Source artifact parsing and record materialisation occur before this check; this is not a heap or
    RSS ceiling.

    Args:
        geography_path (str):
        release (str):
        measure_id (str):
        period (str):
        geography_query (str | Unset):
        code_year (int | Unset):
        format_ (GetMapResourceJoinFormat | Unset):  Default: GetMapResourceJoinFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        IncompatibleGeometryProblem | MapJoinBudgetProblem | MapResourceJoinEnvelope | Problem
    """

    return sync_detailed(
        geography_path=geography_path,
        release=release,
        measure_id=measure_id,
        client=client,
        period=period,
        geography_query=geography_query,
        code_year=code_year,
        format_=format_,
    ).parsed


async def asyncio_detailed(
    geography_path: str,
    release: str,
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str,
    geography_query: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    format_: GetMapResourceJoinFormat | Unset = GetMapResourceJoinFormat.JSON,
) -> Response[
    IncompatibleGeometryProblem
    | MapJoinBudgetProblem
    | MapResourceJoinEnvelope
    | Problem
]:
    """One measure's values, numbered to match this resource's tiles

     The values a renderer joins to the tiles, as `id`, `code` and `value`. The `id` is the same integer
    the tile carries, so a renderer sets feature state by it without reading the geometry. Values are
    joined to this release by matching area code and are never converted: a measure whose source codes
    are not all in this release is refused with `incompatible_geometry`, and the refusal names the
    releases that would carry it. Keeping values out of the tiles is what lets one tileset serve every
    measure, and lets a corrected value invalidate a small table rather than a whole pyramid.

    With `format=parquet` the same table is served as a Parquet file with `id`, `code`, `value` and
    `status` columns, for a warehouse to join to the GeoParquet `features`. Everything the JSON envelope
    says about the table, from the Atlas release to the join rule and provenance, travels in the file's
    `uk-data-atlas` metadata.
    Both formats accept at most 250,000 source records and 16 MiB of uncompressed column payload. The
    byte budget counts 20 bytes per numeric row for id, value and string-length prefixes, plus the UTF-8
    code and status bytes. Oversized joins return `422 Map Join Budget Exceeded` before output rows or
    columns are built, with no partial table and a `links.data` URL for paginated source observations.
    Source artifact parsing and record materialisation occur before this check; this is not a heap or
    RSS ceiling.

    Args:
        geography_path (str):
        release (str):
        measure_id (str):
        period (str):
        geography_query (str | Unset):
        code_year (int | Unset):
        format_ (GetMapResourceJoinFormat | Unset):  Default: GetMapResourceJoinFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[IncompatibleGeometryProblem | MapJoinBudgetProblem | MapResourceJoinEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        geography_path=geography_path,
        release=release,
        measure_id=measure_id,
        period=period,
        geography_query=geography_query,
        code_year=code_year,
        format_=format_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography_path: str,
    release: str,
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str,
    geography_query: str | Unset = UNSET,
    code_year: int | Unset = UNSET,
    format_: GetMapResourceJoinFormat | Unset = GetMapResourceJoinFormat.JSON,
) -> (
    IncompatibleGeometryProblem
    | MapJoinBudgetProblem
    | MapResourceJoinEnvelope
    | Problem
    | None
):
    """One measure's values, numbered to match this resource's tiles

     The values a renderer joins to the tiles, as `id`, `code` and `value`. The `id` is the same integer
    the tile carries, so a renderer sets feature state by it without reading the geometry. Values are
    joined to this release by matching area code and are never converted: a measure whose source codes
    are not all in this release is refused with `incompatible_geometry`, and the refusal names the
    releases that would carry it. Keeping values out of the tiles is what lets one tileset serve every
    measure, and lets a corrected value invalidate a small table rather than a whole pyramid.

    With `format=parquet` the same table is served as a Parquet file with `id`, `code`, `value` and
    `status` columns, for a warehouse to join to the GeoParquet `features`. Everything the JSON envelope
    says about the table, from the Atlas release to the join rule and provenance, travels in the file's
    `uk-data-atlas` metadata.
    Both formats accept at most 250,000 source records and 16 MiB of uncompressed column payload. The
    byte budget counts 20 bytes per numeric row for id, value and string-length prefixes, plus the UTF-8
    code and status bytes. Oversized joins return `422 Map Join Budget Exceeded` before output rows or
    columns are built, with no partial table and a `links.data` URL for paginated source observations.
    Source artifact parsing and record materialisation occur before this check; this is not a heap or
    RSS ceiling.

    Args:
        geography_path (str):
        release (str):
        measure_id (str):
        period (str):
        geography_query (str | Unset):
        code_year (int | Unset):
        format_ (GetMapResourceJoinFormat | Unset):  Default: GetMapResourceJoinFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        IncompatibleGeometryProblem | MapJoinBudgetProblem | MapResourceJoinEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            geography_path=geography_path,
            release=release,
            measure_id=measure_id,
            client=client,
            period=period,
            geography_query=geography_query,
            code_year=code_year,
            format_=format_,
        )
    ).parsed
