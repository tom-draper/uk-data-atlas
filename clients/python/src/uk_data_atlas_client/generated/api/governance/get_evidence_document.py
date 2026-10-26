from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_evidence_document_response_200 import GetEvidenceDocumentResponse200
from ...models.problem import Problem
from ...types import Response


def _get_kwargs(
    document_id: str,
) -> dict[str, Any]:

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/documents/{document_id}.json".format(
            document_id=quote(str(document_id), safe=""),
        ),
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> GetEvidenceDocumentResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = GetEvidenceDocumentResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[GetEvidenceDocumentResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    document_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetEvidenceDocumentResponse200 | Problem]:
    """Download an immutable build evidence document

     Build artifacts that explain release coverage, reviewed conversion validation and other evidence are
    published as immutable JSON documents, rather than query endpoints. Available document ids are
    `analysis-geography-validation`, `corrections`, `geography-health`, `geography-inventory`, `measure-
    compatibility`, `relationship-candidates`, `relationship-repairs`, `validation-report` and
    `measure-{measure-id}` for each measure, such as `measure-population`.

    Args:
        document_id (str): A document id from a measure or release's documents links, without the
            .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetEvidenceDocumentResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        document_id=document_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    document_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetEvidenceDocumentResponse200 | Problem | None:
    """Download an immutable build evidence document

     Build artifacts that explain release coverage, reviewed conversion validation and other evidence are
    published as immutable JSON documents, rather than query endpoints. Available document ids are
    `analysis-geography-validation`, `corrections`, `geography-health`, `geography-inventory`, `measure-
    compatibility`, `relationship-candidates`, `relationship-repairs`, `validation-report` and
    `measure-{measure-id}` for each measure, such as `measure-population`.

    Args:
        document_id (str): A document id from a measure or release's documents links, without the
            .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetEvidenceDocumentResponse200 | Problem
    """

    return sync_detailed(
        document_id=document_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    document_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> Response[GetEvidenceDocumentResponse200 | Problem]:
    """Download an immutable build evidence document

     Build artifacts that explain release coverage, reviewed conversion validation and other evidence are
    published as immutable JSON documents, rather than query endpoints. Available document ids are
    `analysis-geography-validation`, `corrections`, `geography-health`, `geography-inventory`, `measure-
    compatibility`, `relationship-candidates`, `relationship-repairs`, `validation-report` and
    `measure-{measure-id}` for each measure, such as `measure-population`.

    Args:
        document_id (str): A document id from a measure or release's documents links, without the
            .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[GetEvidenceDocumentResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        document_id=document_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    document_id: str,
    *,
    client: AuthenticatedClient | Client,
) -> GetEvidenceDocumentResponse200 | Problem | None:
    """Download an immutable build evidence document

     Build artifacts that explain release coverage, reviewed conversion validation and other evidence are
    published as immutable JSON documents, rather than query endpoints. Available document ids are
    `analysis-geography-validation`, `corrections`, `geography-health`, `geography-inventory`, `measure-
    compatibility`, `relationship-candidates`, `relationship-repairs`, `validation-report` and
    `measure-{measure-id}` for each measure, such as `measure-population`.

    Args:
        document_id (str): A document id from a measure or release's documents links, without the
            .json suffix.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        GetEvidenceDocumentResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            document_id=document_id,
            client=client,
        )
    ).parsed
