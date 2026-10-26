from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.download_bulk_lookup_format import DownloadBulkLookupFormat
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    lookup_id: str,
    *,
    format_: DownloadBulkLookupFormat | Unset = DownloadBulkLookupFormat.CSV,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/lookups/{lookup_id}".format(
            lookup_id=quote(str(lookup_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Problem | str | None:
    if response.status_code == 200:
        response_200 = response.text
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
) -> Response[Problem | str]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkLookupFormat | Unset = DownloadBulkLookupFormat.CSV,
) -> Response[Problem | str]:
    """Download one whole lookup table as CSV or NDJSON

     Renders the lookup from its source artifact and returns it only if the bytes match the hash its
    manifest lists for the format. In CSV a list column is joined with " | " and a cell is quoted only
    when it holds a comma, quote or line break; in NDJSON each line is one row with every column, lists
    as arrays and empty values as null. This response is intentionally not wrapped in the usual API
    envelope.

    Args:
        lookup_id (str):
        format_ (DownloadBulkLookupFormat | Unset):  Default: DownloadBulkLookupFormat.CSV.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | str]
    """

    kwargs = _get_kwargs(
        lookup_id=lookup_id,
        format_=format_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkLookupFormat | Unset = DownloadBulkLookupFormat.CSV,
) -> Problem | str | None:
    """Download one whole lookup table as CSV or NDJSON

     Renders the lookup from its source artifact and returns it only if the bytes match the hash its
    manifest lists for the format. In CSV a list column is joined with " | " and a cell is quoted only
    when it holds a comma, quote or line break; in NDJSON each line is one row with every column, lists
    as arrays and empty values as null. This response is intentionally not wrapped in the usual API
    envelope.

    Args:
        lookup_id (str):
        format_ (DownloadBulkLookupFormat | Unset):  Default: DownloadBulkLookupFormat.CSV.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | str
    """

    return sync_detailed(
        lookup_id=lookup_id,
        client=client,
        format_=format_,
    ).parsed


async def asyncio_detailed(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkLookupFormat | Unset = DownloadBulkLookupFormat.CSV,
) -> Response[Problem | str]:
    """Download one whole lookup table as CSV or NDJSON

     Renders the lookup from its source artifact and returns it only if the bytes match the hash its
    manifest lists for the format. In CSV a list column is joined with " | " and a cell is quoted only
    when it holds a comma, quote or line break; in NDJSON each line is one row with every column, lists
    as arrays and empty values as null. This response is intentionally not wrapped in the usual API
    envelope.

    Args:
        lookup_id (str):
        format_ (DownloadBulkLookupFormat | Unset):  Default: DownloadBulkLookupFormat.CSV.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | str]
    """

    kwargs = _get_kwargs(
        lookup_id=lookup_id,
        format_=format_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    lookup_id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: DownloadBulkLookupFormat | Unset = DownloadBulkLookupFormat.CSV,
) -> Problem | str | None:
    """Download one whole lookup table as CSV or NDJSON

     Renders the lookup from its source artifact and returns it only if the bytes match the hash its
    manifest lists for the format. In CSV a list column is joined with " | " and a cell is quoted only
    when it holds a comma, quote or line break; in NDJSON each line is one row with every column, lists
    as arrays and empty values as null. This response is intentionally not wrapped in the usual API
    envelope.

    Args:
        lookup_id (str):
        format_ (DownloadBulkLookupFormat | Unset):  Default: DownloadBulkLookupFormat.CSV.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | str
    """

    return (
        await asyncio_detailed(
            lookup_id=lookup_id,
            client=client,
            format_=format_,
        )
    ).parsed
