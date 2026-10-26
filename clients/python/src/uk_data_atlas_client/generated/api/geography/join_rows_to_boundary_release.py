from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.join_rows_to_boundary_release_format import (
    JoinRowsToBoundaryReleaseFormat,
)
from ...models.join_rows_to_boundary_release_json_body import (
    JoinRowsToBoundaryReleaseJsonBody,
)
from ...models.join_rows_to_boundary_release_response_200 import (
    JoinRowsToBoundaryReleaseResponse200,
)
from ...models.join_rows_to_boundary_release_tier import JoinRowsToBoundaryReleaseTier
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    *,
    body: JoinRowsToBoundaryReleaseJsonBody,
    format_: JoinRowsToBoundaryReleaseFormat
    | Unset = JoinRowsToBoundaryReleaseFormat.JSON,
    tier: JoinRowsToBoundaryReleaseTier | Unset = JoinRowsToBoundaryReleaseTier.MEDIUM,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    json_tier: str | Unset = UNSET
    if not isinstance(tier, Unset):
        json_tier = tier.value

    params["tier"] = json_tier

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/boundary-releases/{geography}/{release}:join".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
        ),
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> JoinRowsToBoundaryReleaseResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = JoinRowsToBoundaryReleaseResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 405:
        response_405 = Problem.from_dict(response.json())

        return response_405

    if response.status_code == 413:
        response_413 = Problem.from_dict(response.json())

        return response_413

    if response.status_code == 415:
        response_415 = Problem.from_dict(response.json())

        return response_415

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
) -> Response[JoinRowsToBoundaryReleaseResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    body: JoinRowsToBoundaryReleaseJsonBody,
    format_: JoinRowsToBoundaryReleaseFormat
    | Unset = JoinRowsToBoundaryReleaseFormat.JSON,
    tier: JoinRowsToBoundaryReleaseTier | Unset = JoinRowsToBoundaryReleaseTier.MEDIUM,
) -> Response[JoinRowsToBoundaryReleaseResponse200 | Problem]:
    """Join your own rows of codes or names and values to a boundary release

     Send a column of area codes or names with a value each, and get the values back numbered as this
    release's tiles and downloads number their features, ready to draw on its map resource. Nothing is
    stored: the request carries the data, and the answer is never cached.

    Send JSON, `{"rows": [{"area": "E05000650", "value": 12.5}]}`, where the area may also be given as
    `code` or `name` and a row may carry a `parent` to settle a shared name, or CSV with a header naming
    the area column `area`, `code` or `name`, a `value` column and optionally a `parent` column. A CSV
    cell reading as a number is a number, and an empty one is null; any other value, JSON included, is
    passed through as sent. At most 250,000 rows in an 8 MiB body.

    Each row is read as `areas:validate` reads it. A code must be in this release, and a name must mean
    exactly one of its areas. A row that does not is listed in `unjoined` with its reason and the
    validator's full result: a superseded code says which releases hold it, and an ambiguous name lists
    its candidates. Two rows naming the same area leave that area out, both listed as `duplicate-area`,
    because which value was meant is the caller's to say. `values` holds one row per joined area, as
    `id`, `code`, `name` and `value`, where `id` is the integer the tiles carry, so a renderer sets
    feature state by it.

    With `format=geojson` the joined areas come back as a GeoJSON FeatureCollection at the requested
    `tier`, each feature's properties carrying its `value`, with the release's attribution and the join
    summary beside the features. A tier whose GeoJSON exceeds 64 MB is refused with 422, since the join
    table and the tiles draw the same map without parsing a whole release per request.

    Args:
        geography (str):
        release (str):
        format_ (JoinRowsToBoundaryReleaseFormat | Unset):  Default:
            JoinRowsToBoundaryReleaseFormat.JSON.
        tier (JoinRowsToBoundaryReleaseTier | Unset):  Default:
            JoinRowsToBoundaryReleaseTier.MEDIUM.
        body (JoinRowsToBoundaryReleaseJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[JoinRowsToBoundaryReleaseResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        body=body,
        format_=format_,
        tier=tier,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    body: JoinRowsToBoundaryReleaseJsonBody,
    format_: JoinRowsToBoundaryReleaseFormat
    | Unset = JoinRowsToBoundaryReleaseFormat.JSON,
    tier: JoinRowsToBoundaryReleaseTier | Unset = JoinRowsToBoundaryReleaseTier.MEDIUM,
) -> JoinRowsToBoundaryReleaseResponse200 | Problem | None:
    """Join your own rows of codes or names and values to a boundary release

     Send a column of area codes or names with a value each, and get the values back numbered as this
    release's tiles and downloads number their features, ready to draw on its map resource. Nothing is
    stored: the request carries the data, and the answer is never cached.

    Send JSON, `{"rows": [{"area": "E05000650", "value": 12.5}]}`, where the area may also be given as
    `code` or `name` and a row may carry a `parent` to settle a shared name, or CSV with a header naming
    the area column `area`, `code` or `name`, a `value` column and optionally a `parent` column. A CSV
    cell reading as a number is a number, and an empty one is null; any other value, JSON included, is
    passed through as sent. At most 250,000 rows in an 8 MiB body.

    Each row is read as `areas:validate` reads it. A code must be in this release, and a name must mean
    exactly one of its areas. A row that does not is listed in `unjoined` with its reason and the
    validator's full result: a superseded code says which releases hold it, and an ambiguous name lists
    its candidates. Two rows naming the same area leave that area out, both listed as `duplicate-area`,
    because which value was meant is the caller's to say. `values` holds one row per joined area, as
    `id`, `code`, `name` and `value`, where `id` is the integer the tiles carry, so a renderer sets
    feature state by it.

    With `format=geojson` the joined areas come back as a GeoJSON FeatureCollection at the requested
    `tier`, each feature's properties carrying its `value`, with the release's attribution and the join
    summary beside the features. A tier whose GeoJSON exceeds 64 MB is refused with 422, since the join
    table and the tiles draw the same map without parsing a whole release per request.

    Args:
        geography (str):
        release (str):
        format_ (JoinRowsToBoundaryReleaseFormat | Unset):  Default:
            JoinRowsToBoundaryReleaseFormat.JSON.
        tier (JoinRowsToBoundaryReleaseTier | Unset):  Default:
            JoinRowsToBoundaryReleaseTier.MEDIUM.
        body (JoinRowsToBoundaryReleaseJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        JoinRowsToBoundaryReleaseResponse200 | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        client=client,
        body=body,
        format_=format_,
        tier=tier,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    body: JoinRowsToBoundaryReleaseJsonBody,
    format_: JoinRowsToBoundaryReleaseFormat
    | Unset = JoinRowsToBoundaryReleaseFormat.JSON,
    tier: JoinRowsToBoundaryReleaseTier | Unset = JoinRowsToBoundaryReleaseTier.MEDIUM,
) -> Response[JoinRowsToBoundaryReleaseResponse200 | Problem]:
    """Join your own rows of codes or names and values to a boundary release

     Send a column of area codes or names with a value each, and get the values back numbered as this
    release's tiles and downloads number their features, ready to draw on its map resource. Nothing is
    stored: the request carries the data, and the answer is never cached.

    Send JSON, `{"rows": [{"area": "E05000650", "value": 12.5}]}`, where the area may also be given as
    `code` or `name` and a row may carry a `parent` to settle a shared name, or CSV with a header naming
    the area column `area`, `code` or `name`, a `value` column and optionally a `parent` column. A CSV
    cell reading as a number is a number, and an empty one is null; any other value, JSON included, is
    passed through as sent. At most 250,000 rows in an 8 MiB body.

    Each row is read as `areas:validate` reads it. A code must be in this release, and a name must mean
    exactly one of its areas. A row that does not is listed in `unjoined` with its reason and the
    validator's full result: a superseded code says which releases hold it, and an ambiguous name lists
    its candidates. Two rows naming the same area leave that area out, both listed as `duplicate-area`,
    because which value was meant is the caller's to say. `values` holds one row per joined area, as
    `id`, `code`, `name` and `value`, where `id` is the integer the tiles carry, so a renderer sets
    feature state by it.

    With `format=geojson` the joined areas come back as a GeoJSON FeatureCollection at the requested
    `tier`, each feature's properties carrying its `value`, with the release's attribution and the join
    summary beside the features. A tier whose GeoJSON exceeds 64 MB is refused with 422, since the join
    table and the tiles draw the same map without parsing a whole release per request.

    Args:
        geography (str):
        release (str):
        format_ (JoinRowsToBoundaryReleaseFormat | Unset):  Default:
            JoinRowsToBoundaryReleaseFormat.JSON.
        tier (JoinRowsToBoundaryReleaseTier | Unset):  Default:
            JoinRowsToBoundaryReleaseTier.MEDIUM.
        body (JoinRowsToBoundaryReleaseJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[JoinRowsToBoundaryReleaseResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        body=body,
        format_=format_,
        tier=tier,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    body: JoinRowsToBoundaryReleaseJsonBody,
    format_: JoinRowsToBoundaryReleaseFormat
    | Unset = JoinRowsToBoundaryReleaseFormat.JSON,
    tier: JoinRowsToBoundaryReleaseTier | Unset = JoinRowsToBoundaryReleaseTier.MEDIUM,
) -> JoinRowsToBoundaryReleaseResponse200 | Problem | None:
    """Join your own rows of codes or names and values to a boundary release

     Send a column of area codes or names with a value each, and get the values back numbered as this
    release's tiles and downloads number their features, ready to draw on its map resource. Nothing is
    stored: the request carries the data, and the answer is never cached.

    Send JSON, `{"rows": [{"area": "E05000650", "value": 12.5}]}`, where the area may also be given as
    `code` or `name` and a row may carry a `parent` to settle a shared name, or CSV with a header naming
    the area column `area`, `code` or `name`, a `value` column and optionally a `parent` column. A CSV
    cell reading as a number is a number, and an empty one is null; any other value, JSON included, is
    passed through as sent. At most 250,000 rows in an 8 MiB body.

    Each row is read as `areas:validate` reads it. A code must be in this release, and a name must mean
    exactly one of its areas. A row that does not is listed in `unjoined` with its reason and the
    validator's full result: a superseded code says which releases hold it, and an ambiguous name lists
    its candidates. Two rows naming the same area leave that area out, both listed as `duplicate-area`,
    because which value was meant is the caller's to say. `values` holds one row per joined area, as
    `id`, `code`, `name` and `value`, where `id` is the integer the tiles carry, so a renderer sets
    feature state by it.

    With `format=geojson` the joined areas come back as a GeoJSON FeatureCollection at the requested
    `tier`, each feature's properties carrying its `value`, with the release's attribution and the join
    summary beside the features. A tier whose GeoJSON exceeds 64 MB is refused with 422, since the join
    table and the tiles draw the same map without parsing a whole release per request.

    Args:
        geography (str):
        release (str):
        format_ (JoinRowsToBoundaryReleaseFormat | Unset):  Default:
            JoinRowsToBoundaryReleaseFormat.JSON.
        tier (JoinRowsToBoundaryReleaseTier | Unset):  Default:
            JoinRowsToBoundaryReleaseTier.MEDIUM.
        body (JoinRowsToBoundaryReleaseJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        JoinRowsToBoundaryReleaseResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            client=client,
            body=body,
            format_=format_,
            tier=tier,
        )
    ).parsed
