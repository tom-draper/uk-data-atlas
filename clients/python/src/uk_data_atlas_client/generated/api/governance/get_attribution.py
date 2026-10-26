from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    dataset: list[str] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    boundary_release: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_dataset: list[str] | Unset = UNSET
    if not isinstance(dataset, Unset):
        json_dataset = dataset

    params["dataset"] = json_dataset

    json_measure: list[str] | Unset = UNSET
    if not isinstance(measure, Unset):
        json_measure = measure

    params["measure"] = json_measure

    json_boundary_release: list[str] | Unset = UNSET
    if not isinstance(boundary_release, Unset):
        json_boundary_release = boundary_release

    params["boundaryRelease"] = json_boundary_release

    json_crosswalk: list[str] | Unset = UNSET
    if not isinstance(crosswalk, Unset):
        json_crosswalk = crosswalk

    params["crosswalk"] = json_crosswalk

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/attribution",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Envelope | Problem | None:
    if response.status_code == 200:
        response_200 = Envelope.from_dict(response.json())

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
) -> Response[Envelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    dataset: list[str] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    boundary_release: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Assemble the attribution and licence block for named resources

     Collects the publisher, source and licence of every resource behind an answer, and returns a plain-
    text block suitable for a map corner, a report footer or a bulk-download README. Name at least one
    of `dataset`, `measure`, `boundaryRelease` or `crosswalk`; each may be repeated, and a resource
    named more than one way is listed once.
    A measure is attributed through the datasets its observations come from. A crosswalk is compiled by
    the Atlas rather than obtained, so it carries no licence of its own and the boundary releases at its
    endpoints are attributed instead, with the crosswalk listing them in `derivedFrom`.
    Licence names are reproduced exactly as the publisher states them and are not interpreted. One
    catalogue source already carries two licences across its date range, so which terms govern a
    combined work is the caller's judgement rather than this API's.

    Args:
        dataset (list[str] | Unset):
        measure (list[str] | Unset):
        boundary_release (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        dataset=dataset,
        measure=measure,
        boundary_release=boundary_release,
        crosswalk=crosswalk,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    dataset: list[str] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    boundary_release: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> Envelope | Problem | None:
    """Assemble the attribution and licence block for named resources

     Collects the publisher, source and licence of every resource behind an answer, and returns a plain-
    text block suitable for a map corner, a report footer or a bulk-download README. Name at least one
    of `dataset`, `measure`, `boundaryRelease` or `crosswalk`; each may be repeated, and a resource
    named more than one way is listed once.
    A measure is attributed through the datasets its observations come from. A crosswalk is compiled by
    the Atlas rather than obtained, so it carries no licence of its own and the boundary releases at its
    endpoints are attributed instead, with the crosswalk listing them in `derivedFrom`.
    Licence names are reproduced exactly as the publisher states them and are not interpreted. One
    catalogue source already carries two licences across its date range, so which terms govern a
    combined work is the caller's judgement rather than this API's.

    Args:
        dataset (list[str] | Unset):
        measure (list[str] | Unset):
        boundary_release (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        client=client,
        dataset=dataset,
        measure=measure,
        boundary_release=boundary_release,
        crosswalk=crosswalk,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    dataset: list[str] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    boundary_release: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Assemble the attribution and licence block for named resources

     Collects the publisher, source and licence of every resource behind an answer, and returns a plain-
    text block suitable for a map corner, a report footer or a bulk-download README. Name at least one
    of `dataset`, `measure`, `boundaryRelease` or `crosswalk`; each may be repeated, and a resource
    named more than one way is listed once.
    A measure is attributed through the datasets its observations come from. A crosswalk is compiled by
    the Atlas rather than obtained, so it carries no licence of its own and the boundary releases at its
    endpoints are attributed instead, with the crosswalk listing them in `derivedFrom`.
    Licence names are reproduced exactly as the publisher states them and are not interpreted. One
    catalogue source already carries two licences across its date range, so which terms govern a
    combined work is the caller's judgement rather than this API's.

    Args:
        dataset (list[str] | Unset):
        measure (list[str] | Unset):
        boundary_release (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        dataset=dataset,
        measure=measure,
        boundary_release=boundary_release,
        crosswalk=crosswalk,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    dataset: list[str] | Unset = UNSET,
    measure: list[str] | Unset = UNSET,
    boundary_release: list[str] | Unset = UNSET,
    crosswalk: list[str] | Unset = UNSET,
) -> Envelope | Problem | None:
    """Assemble the attribution and licence block for named resources

     Collects the publisher, source and licence of every resource behind an answer, and returns a plain-
    text block suitable for a map corner, a report footer or a bulk-download README. Name at least one
    of `dataset`, `measure`, `boundaryRelease` or `crosswalk`; each may be repeated, and a resource
    named more than one way is listed once.
    A measure is attributed through the datasets its observations come from. A crosswalk is compiled by
    the Atlas rather than obtained, so it carries no licence of its own and the boundary releases at its
    endpoints are attributed instead, with the crosswalk listing them in `derivedFrom`.
    Licence names are reproduced exactly as the publisher states them and are not interpreted. One
    catalogue source already carries two licences across its date range, so which terms govern a
    combined work is the caller's judgement rather than this API's.

    Args:
        dataset (list[str] | Unset):
        measure (list[str] | Unset):
        boundary_release (list[str] | Unset):
        crosswalk (list[str] | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            dataset=dataset,
            measure=measure,
            boundary_release=boundary_release,
            crosswalk=crosswalk,
        )
    ).parsed
