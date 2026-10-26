from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.export_manifest_envelope import ExportManifestEnvelope
from ...models.problem import Problem
from ...types import Response


def _get_kwargs() -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/exports",
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> ExportManifestEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = ExportManifestEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[ExportManifestEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[ExportManifestEnvelope | Problem]:
    """List release-pinned whole observation artifacts

     Returns immutable JSON downloads for each published measure-source partition, under the Atlas
    release that pins the manifest. Every entry names the artifact, its content hash and byte size, and
    describes it as read from the artifact at build time: its record counts, layout, record fields and
    the datasets to attribute. Field meanings and dataset attribution are listed once in `fields` and
    `datasets`. Optional `formats` lists prebuilt CSV and Parquet files of the named measure, with the
    byte size, content hash and download link for each format.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ExportManifestEnvelope | Problem]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
) -> ExportManifestEnvelope | Problem | None:
    """List release-pinned whole observation artifacts

     Returns immutable JSON downloads for each published measure-source partition, under the Atlas
    release that pins the manifest. Every entry names the artifact, its content hash and byte size, and
    describes it as read from the artifact at build time: its record counts, layout, record fields and
    the datasets to attribute. Field meanings and dataset attribution are listed once in `fields` and
    `datasets`. Optional `formats` lists prebuilt CSV and Parquet files of the named measure, with the
    byte size, content hash and download link for each format.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ExportManifestEnvelope | Problem
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
) -> Response[ExportManifestEnvelope | Problem]:
    """List release-pinned whole observation artifacts

     Returns immutable JSON downloads for each published measure-source partition, under the Atlas
    release that pins the manifest. Every entry names the artifact, its content hash and byte size, and
    describes it as read from the artifact at build time: its record counts, layout, record fields and
    the datasets to attribute. Field meanings and dataset attribution are listed once in `fields` and
    `datasets`. Optional `formats` lists prebuilt CSV and Parquet files of the named measure, with the
    byte size, content hash and download link for each format.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ExportManifestEnvelope | Problem]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
) -> ExportManifestEnvelope | Problem | None:
    """List release-pinned whole observation artifacts

     Returns immutable JSON downloads for each published measure-source partition, under the Atlas
    release that pins the manifest. Every entry names the artifact, its content hash and byte size, and
    describes it as read from the artifact at build time: its record counts, layout, record fields and
    the datasets to attribute. Field meanings and dataset attribution are listed once in `fields` and
    `datasets`. Optional `formats` lists prebuilt CSV and Parquet files of the named measure, with the
    byte size, content hash and download link for each format.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ExportManifestEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
