from http import HTTPStatus
from io import BytesIO
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.download_measure_format import DownloadMeasureFormat
from ...models.problem import Problem
from ...types import UNSET, File, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    format_: DownloadMeasureFormat | Unset = DownloadMeasureFormat.PARQUET,
    hash_: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    params["hash"] = hash_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/export".format(
            measure_id=quote(str(measure_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> File | Problem | None:
    if response.status_code == 200:
        response_200 = File(payload=BytesIO(response.text))

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
) -> Response[File | Problem]:
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
    format_: DownloadMeasureFormat | Unset = DownloadMeasureFormat.PARQUET,
    hash_: str | Unset = UNSET,
) -> Response[File | Problem]:
    """Download every observation for a measure

     Download a measure across all its published areas and periods. Rows are ordered by geography,
    boundary release, period, area code, dataset and series. CSV and Parquet contain the same rows,
    including dimension members, status and uncertainty bounds when available. A hash-pinned URL is
    immutable.

    Args:
        measure_id (str):
        format_ (DownloadMeasureFormat | Unset):  Default: DownloadMeasureFormat.PARQUET.
        hash_ (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        format_=format_,
        hash_=hash_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadMeasureFormat | Unset = DownloadMeasureFormat.PARQUET,
    hash_: str | Unset = UNSET,
) -> File | Problem | None:
    """Download every observation for a measure

     Download a measure across all its published areas and periods. Rows are ordered by geography,
    boundary release, period, area code, dataset and series. CSV and Parquet contain the same rows,
    including dimension members, status and uncertainty bounds when available. A hash-pinned URL is
    immutable.

    Args:
        measure_id (str):
        format_ (DownloadMeasureFormat | Unset):  Default: DownloadMeasureFormat.PARQUET.
        hash_ (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        format_=format_,
        hash_=hash_,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadMeasureFormat | Unset = DownloadMeasureFormat.PARQUET,
    hash_: str | Unset = UNSET,
) -> Response[File | Problem]:
    """Download every observation for a measure

     Download a measure across all its published areas and periods. Rows are ordered by geography,
    boundary release, period, area code, dataset and series. CSV and Parquet contain the same rows,
    including dimension members, status and uncertainty bounds when available. A hash-pinned URL is
    immutable.

    Args:
        measure_id (str):
        format_ (DownloadMeasureFormat | Unset):  Default: DownloadMeasureFormat.PARQUET.
        hash_ (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        format_=format_,
        hash_=hash_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadMeasureFormat | Unset = DownloadMeasureFormat.PARQUET,
    hash_: str | Unset = UNSET,
) -> File | Problem | None:
    """Download every observation for a measure

     Download a measure across all its published areas and periods. Rows are ordered by geography,
    boundary release, period, area code, dataset and series. CSV and Parquet contain the same rows,
    including dimension members, status and uncertainty bounds when available. A hash-pinned URL is
    immutable.

    Args:
        measure_id (str):
        format_ (DownloadMeasureFormat | Unset):  Default: DownloadMeasureFormat.PARQUET.
        hash_ (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
    """

    return (
        await asyncio_detailed(
            measure_id=measure_id,
            client=client,
            format_=format_,
            hash_=hash_,
        )
    ).parsed
