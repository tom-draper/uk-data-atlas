from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.analysis_geography_list_envelope import AnalysisGeographyListEnvelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    measure: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["measure"] = measure

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/analysis-geographies",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AnalysisGeographyListEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = AnalysisGeographyListEnvelope.from_dict(response.json())

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
) -> Response[AnalysisGeographyListEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    measure: str | Unset = UNSET,
) -> Response[AnalysisGeographyListEnvelope | Problem]:
    """List reviewed analysis geography conversions

     Lists the measure/source/frame conversions that the Atlas has reviewed as safe to perform. A
    published crosswalk alone is not sufficient. A reviewed conversion is one crosswalk, or a published
    relationship path whose `conversion.method` is `relationship-path` and whose `conversion.steps` list
    each crosswalk and direction it runs through.

    Args:
        measure (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AnalysisGeographyListEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        measure=measure,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    measure: str | Unset = UNSET,
) -> AnalysisGeographyListEnvelope | Problem | None:
    """List reviewed analysis geography conversions

     Lists the measure/source/frame conversions that the Atlas has reviewed as safe to perform. A
    published crosswalk alone is not sufficient. A reviewed conversion is one crosswalk, or a published
    relationship path whose `conversion.method` is `relationship-path` and whose `conversion.steps` list
    each crosswalk and direction it runs through.

    Args:
        measure (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AnalysisGeographyListEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        measure=measure,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    measure: str | Unset = UNSET,
) -> Response[AnalysisGeographyListEnvelope | Problem]:
    """List reviewed analysis geography conversions

     Lists the measure/source/frame conversions that the Atlas has reviewed as safe to perform. A
    published crosswalk alone is not sufficient. A reviewed conversion is one crosswalk, or a published
    relationship path whose `conversion.method` is `relationship-path` and whose `conversion.steps` list
    each crosswalk and direction it runs through.

    Args:
        measure (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AnalysisGeographyListEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        measure=measure,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    measure: str | Unset = UNSET,
) -> AnalysisGeographyListEnvelope | Problem | None:
    """List reviewed analysis geography conversions

     Lists the measure/source/frame conversions that the Atlas has reviewed as safe to perform. A
    published crosswalk alone is not sufficient. A reviewed conversion is one crosswalk, or a published
    relationship path whose `conversion.method` is `relationship-path` and whose `conversion.steps` list
    each crosswalk and direction it runs through.

    Args:
        measure (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AnalysisGeographyListEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            measure=measure,
        )
    ).parsed
