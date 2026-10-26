from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.download_bulk_export_format import DownloadBulkExportFormat
from ...models.download_bulk_export_response_200 import DownloadBulkExportResponse200
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    export_id: str,
    *,
    format_: DownloadBulkExportFormat | Unset = DownloadBulkExportFormat.JSON,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/exports/{export_id}".format(
            export_id=quote(str(export_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> DownloadBulkExportResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = DownloadBulkExportResponse200.from_dict(response.json())

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
) -> Response[DownloadBulkExportResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    export_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkExportFormat | Unset = DownloadBulkExportFormat.JSON,
) -> Response[DownloadBulkExportResponse200 | Problem]:
    """Download one immutable source observation artifact

     Defaults to the source JSON artifact. Use `format=csv` or `format=parquet` for a prebuilt flat file
    of the named measure across all periods. Shared tables are projected to that measure, preserving
    null cells. Rows carry measureId, unit, datasetId, geography, boundaryYear, period, areaCode,
    sourceAreaCode, value, category, status, lowerBound and upperBound. Missing fields are empty in CSV
    and null in Parquet. Sizes and hashes for the flat files are listed in each export's `formats`. The
    response is not wrapped in the usual API envelope.

    Args:
        export_id (str):
        format_ (DownloadBulkExportFormat | Unset):  Default: DownloadBulkExportFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DownloadBulkExportResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        export_id=export_id,
        format_=format_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    export_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkExportFormat | Unset = DownloadBulkExportFormat.JSON,
) -> DownloadBulkExportResponse200 | Problem | None:
    """Download one immutable source observation artifact

     Defaults to the source JSON artifact. Use `format=csv` or `format=parquet` for a prebuilt flat file
    of the named measure across all periods. Shared tables are projected to that measure, preserving
    null cells. Rows carry measureId, unit, datasetId, geography, boundaryYear, period, areaCode,
    sourceAreaCode, value, category, status, lowerBound and upperBound. Missing fields are empty in CSV
    and null in Parquet. Sizes and hashes for the flat files are listed in each export's `formats`. The
    response is not wrapped in the usual API envelope.

    Args:
        export_id (str):
        format_ (DownloadBulkExportFormat | Unset):  Default: DownloadBulkExportFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DownloadBulkExportResponse200 | Problem
    """

    return sync_detailed(
        export_id=export_id,
        client=client,
        format_=format_,
    ).parsed


async def asyncio_detailed(
    export_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkExportFormat | Unset = DownloadBulkExportFormat.JSON,
) -> Response[DownloadBulkExportResponse200 | Problem]:
    """Download one immutable source observation artifact

     Defaults to the source JSON artifact. Use `format=csv` or `format=parquet` for a prebuilt flat file
    of the named measure across all periods. Shared tables are projected to that measure, preserving
    null cells. Rows carry measureId, unit, datasetId, geography, boundaryYear, period, areaCode,
    sourceAreaCode, value, category, status, lowerBound and upperBound. Missing fields are empty in CSV
    and null in Parquet. Sizes and hashes for the flat files are listed in each export's `formats`. The
    response is not wrapped in the usual API envelope.

    Args:
        export_id (str):
        format_ (DownloadBulkExportFormat | Unset):  Default: DownloadBulkExportFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DownloadBulkExportResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        export_id=export_id,
        format_=format_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    export_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkExportFormat | Unset = DownloadBulkExportFormat.JSON,
) -> DownloadBulkExportResponse200 | Problem | None:
    """Download one immutable source observation artifact

     Defaults to the source JSON artifact. Use `format=csv` or `format=parquet` for a prebuilt flat file
    of the named measure across all periods. Shared tables are projected to that measure, preserving
    null cells. Rows carry measureId, unit, datasetId, geography, boundaryYear, period, areaCode,
    sourceAreaCode, value, category, status, lowerBound and upperBound. Missing fields are empty in CSV
    and null in Parquet. Sizes and hashes for the flat files are listed in each export's `formats`. The
    response is not wrapped in the usual API envelope.

    Args:
        export_id (str):
        format_ (DownloadBulkExportFormat | Unset):  Default: DownloadBulkExportFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DownloadBulkExportResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            export_id=export_id,
            client=client,
            format_=format_,
        )
    ).parsed
