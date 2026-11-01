from http import HTTPStatus
from io import BytesIO
from typing import Any, cast
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_map_resource_features_format import GetMapResourceFeaturesFormat
from ...models.get_map_resource_features_tier import GetMapResourceFeaturesTier
from ...models.problem import Problem
from ...types import UNSET, File, Response, Unset


def _get_kwargs(
    geography: str,
    release: str,
    *,
    tier: GetMapResourceFeaturesTier,
    format_: GetMapResourceFeaturesFormat
    | Unset = GetMapResourceFeaturesFormat.GEOPARQUET,
    range_: str | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(range_, Unset):
        headers["Range"] = range_

    params: dict[str, Any] = {}

    json_tier = tier.value
    params["tier"] = json_tier

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/map-resources/{geography}/{release}/features".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
        ),
        "params": params,
    }

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | File | Problem | None:
    if response.status_code == 200:
        response_200 = File(payload=BytesIO(response.json()))

        return response_200

    if response.status_code == 206:
        response_206 = File(payload=BytesIO(response.content))

        return response_206

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 416:
        response_416 = cast(Any, None)
        return response_416

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | File | Problem]:
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
    tier: GetMapResourceFeaturesTier,
    format_: GetMapResourceFeaturesFormat
    | Unset = GetMapResourceFeaturesFormat.GEOPARQUET,
    range_: str | Unset = UNSET,
) -> Response[Any | File | Problem]:
    """A whole boundary release as one GeoParquet or GeoJSON file

     The flat form of the resource, for a warehouse or a GIS that holds features rather than tiles:
    GeoParquet 1.1 with one row per area, carrying the same `id`, `code` and `name` as the tiles, its
    shape as WKB in OGC:CRS84, and a `bbox` covering column a reader can filter on. Each tier is
    compiled from the same shared-arc generalisation the tiles are drawn from, so neighbours share their
    borders exactly, and the ids are the ones a join table publishes, so values join by `id` or `code`
    without reading a tile. Every tier is published, `full` included, and its size and SHA-256 are
    listed under `features` in the descriptor. Downloads are generated from the geometry store on
    request, checked against their published hashes and cached within a bounded byte budget. Cold
    requests for large releases can take longer; generation is serialized. A coarse tier keeps every
    border shared but is not guaranteed to be a valid polygon everywhere, as the descriptor's
    `generalisation` says. The file's `uk-data-atlas` metadata names the resource, tier, attribution and
    publisher file hash, so a copy loaded on its own is still citable.
    `format=geojson` returns the same features as an RFC 7946 FeatureCollection, for the tools that open
    GeoJSON directly. It is published at the `medium` and `low` tiers only; `full` and `high` are
    GeoParquet only, and asking for them as GeoJSON answers 404. Each feature has the same `id`, and
    `code` and `name` properties; coordinates are written to six decimal places, about 0.1 m. A client
    sending `Accept-Encoding: gzip` receives it with `Content-Encoding: gzip` and one that does not
    receives it decoded. The two encodings have different `ETag`s, and the descriptor's `bytes` and
    `contentHash` describe the decoded GeoJSON.
    The GeoParquet file honours byte-range requests, so DuckDB, GDAL or any reader that fetches Parquet
    over HTTP can read its footer and only the row groups it needs. The GeoJSON is always sent whole.

    Args:
        geography (str):
        release (str):
        tier (GetMapResourceFeaturesTier):
        format_ (GetMapResourceFeaturesFormat | Unset):  Default:
            GetMapResourceFeaturesFormat.GEOPARQUET.
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | File | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        tier=tier,
        format_=format_,
        range_=range_,
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
    tier: GetMapResourceFeaturesTier,
    format_: GetMapResourceFeaturesFormat
    | Unset = GetMapResourceFeaturesFormat.GEOPARQUET,
    range_: str | Unset = UNSET,
) -> Any | File | Problem | None:
    """A whole boundary release as one GeoParquet or GeoJSON file

     The flat form of the resource, for a warehouse or a GIS that holds features rather than tiles:
    GeoParquet 1.1 with one row per area, carrying the same `id`, `code` and `name` as the tiles, its
    shape as WKB in OGC:CRS84, and a `bbox` covering column a reader can filter on. Each tier is
    compiled from the same shared-arc generalisation the tiles are drawn from, so neighbours share their
    borders exactly, and the ids are the ones a join table publishes, so values join by `id` or `code`
    without reading a tile. Every tier is published, `full` included, and its size and SHA-256 are
    listed under `features` in the descriptor. Downloads are generated from the geometry store on
    request, checked against their published hashes and cached within a bounded byte budget. Cold
    requests for large releases can take longer; generation is serialized. A coarse tier keeps every
    border shared but is not guaranteed to be a valid polygon everywhere, as the descriptor's
    `generalisation` says. The file's `uk-data-atlas` metadata names the resource, tier, attribution and
    publisher file hash, so a copy loaded on its own is still citable.
    `format=geojson` returns the same features as an RFC 7946 FeatureCollection, for the tools that open
    GeoJSON directly. It is published at the `medium` and `low` tiers only; `full` and `high` are
    GeoParquet only, and asking for them as GeoJSON answers 404. Each feature has the same `id`, and
    `code` and `name` properties; coordinates are written to six decimal places, about 0.1 m. A client
    sending `Accept-Encoding: gzip` receives it with `Content-Encoding: gzip` and one that does not
    receives it decoded. The two encodings have different `ETag`s, and the descriptor's `bytes` and
    `contentHash` describe the decoded GeoJSON.
    The GeoParquet file honours byte-range requests, so DuckDB, GDAL or any reader that fetches Parquet
    over HTTP can read its footer and only the row groups it needs. The GeoJSON is always sent whole.

    Args:
        geography (str):
        release (str):
        tier (GetMapResourceFeaturesTier):
        format_ (GetMapResourceFeaturesFormat | Unset):  Default:
            GetMapResourceFeaturesFormat.GEOPARQUET.
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | File | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        client=client,
        tier=tier,
        format_=format_,
        range_=range_,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetMapResourceFeaturesTier,
    format_: GetMapResourceFeaturesFormat
    | Unset = GetMapResourceFeaturesFormat.GEOPARQUET,
    range_: str | Unset = UNSET,
) -> Response[Any | File | Problem]:
    """A whole boundary release as one GeoParquet or GeoJSON file

     The flat form of the resource, for a warehouse or a GIS that holds features rather than tiles:
    GeoParquet 1.1 with one row per area, carrying the same `id`, `code` and `name` as the tiles, its
    shape as WKB in OGC:CRS84, and a `bbox` covering column a reader can filter on. Each tier is
    compiled from the same shared-arc generalisation the tiles are drawn from, so neighbours share their
    borders exactly, and the ids are the ones a join table publishes, so values join by `id` or `code`
    without reading a tile. Every tier is published, `full` included, and its size and SHA-256 are
    listed under `features` in the descriptor. Downloads are generated from the geometry store on
    request, checked against their published hashes and cached within a bounded byte budget. Cold
    requests for large releases can take longer; generation is serialized. A coarse tier keeps every
    border shared but is not guaranteed to be a valid polygon everywhere, as the descriptor's
    `generalisation` says. The file's `uk-data-atlas` metadata names the resource, tier, attribution and
    publisher file hash, so a copy loaded on its own is still citable.
    `format=geojson` returns the same features as an RFC 7946 FeatureCollection, for the tools that open
    GeoJSON directly. It is published at the `medium` and `low` tiers only; `full` and `high` are
    GeoParquet only, and asking for them as GeoJSON answers 404. Each feature has the same `id`, and
    `code` and `name` properties; coordinates are written to six decimal places, about 0.1 m. A client
    sending `Accept-Encoding: gzip` receives it with `Content-Encoding: gzip` and one that does not
    receives it decoded. The two encodings have different `ETag`s, and the descriptor's `bytes` and
    `contentHash` describe the decoded GeoJSON.
    The GeoParquet file honours byte-range requests, so DuckDB, GDAL or any reader that fetches Parquet
    over HTTP can read its footer and only the row groups it needs. The GeoJSON is always sent whole.

    Args:
        geography (str):
        release (str):
        tier (GetMapResourceFeaturesTier):
        format_ (GetMapResourceFeaturesFormat | Unset):  Default:
            GetMapResourceFeaturesFormat.GEOPARQUET.
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | File | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        tier=tier,
        format_=format_,
        range_=range_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    *,
    client: AuthenticatedClient | Client,
    tier: GetMapResourceFeaturesTier,
    format_: GetMapResourceFeaturesFormat
    | Unset = GetMapResourceFeaturesFormat.GEOPARQUET,
    range_: str | Unset = UNSET,
) -> Any | File | Problem | None:
    """A whole boundary release as one GeoParquet or GeoJSON file

     The flat form of the resource, for a warehouse or a GIS that holds features rather than tiles:
    GeoParquet 1.1 with one row per area, carrying the same `id`, `code` and `name` as the tiles, its
    shape as WKB in OGC:CRS84, and a `bbox` covering column a reader can filter on. Each tier is
    compiled from the same shared-arc generalisation the tiles are drawn from, so neighbours share their
    borders exactly, and the ids are the ones a join table publishes, so values join by `id` or `code`
    without reading a tile. Every tier is published, `full` included, and its size and SHA-256 are
    listed under `features` in the descriptor. Downloads are generated from the geometry store on
    request, checked against their published hashes and cached within a bounded byte budget. Cold
    requests for large releases can take longer; generation is serialized. A coarse tier keeps every
    border shared but is not guaranteed to be a valid polygon everywhere, as the descriptor's
    `generalisation` says. The file's `uk-data-atlas` metadata names the resource, tier, attribution and
    publisher file hash, so a copy loaded on its own is still citable.
    `format=geojson` returns the same features as an RFC 7946 FeatureCollection, for the tools that open
    GeoJSON directly. It is published at the `medium` and `low` tiers only; `full` and `high` are
    GeoParquet only, and asking for them as GeoJSON answers 404. Each feature has the same `id`, and
    `code` and `name` properties; coordinates are written to six decimal places, about 0.1 m. A client
    sending `Accept-Encoding: gzip` receives it with `Content-Encoding: gzip` and one that does not
    receives it decoded. The two encodings have different `ETag`s, and the descriptor's `bytes` and
    `contentHash` describe the decoded GeoJSON.
    The GeoParquet file honours byte-range requests, so DuckDB, GDAL or any reader that fetches Parquet
    over HTTP can read its footer and only the row groups it needs. The GeoJSON is always sent whole.

    Args:
        geography (str):
        release (str):
        tier (GetMapResourceFeaturesTier):
        format_ (GetMapResourceFeaturesFormat | Unset):  Default:
            GetMapResourceFeaturesFormat.GEOPARQUET.
        range_ (str | Unset):  Example: bytes=0-16383.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | File | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            client=client,
            tier=tier,
            format_=format_,
            range_=range_,
        )
    ).parsed
