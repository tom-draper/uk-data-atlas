from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...models.resolve_boundary_release_for_date_country import (
    ResolveBoundaryReleaseForDateCountry,
)
from ...models.resolve_boundary_release_for_date_response_200 import (
    ResolveBoundaryReleaseForDateResponse200,
)
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    geography: str,
    date: str,
    country: ResolveBoundaryReleaseForDateCountry | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["date"] = date

    json_country: str | Unset = UNSET
    if not isinstance(country, Unset):
        json_country = country.value

    params["country"] = json_country

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/boundary-releases:resolve",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Problem | ResolveBoundaryReleaseForDateResponse200 | None:
    if response.status_code == 200:
        response_200 = ResolveBoundaryReleaseForDateResponse200.from_dict(
            response.json()
        )

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 409:
        response_409 = Problem.from_dict(response.json())

        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Problem | ResolveBoundaryReleaseForDateResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    date: str,
    country: ResolveBoundaryReleaseForDateCountry | Unset = UNSET,
) -> Response[Problem | ResolveBoundaryReleaseForDateResponse200]:
    """Select the boundary release to use for a date

     Returns the latest release of a geography dated on or before `date` that covers `country` when one
    is given, as an exact release id rather than a moving `latest` alias. Releases are snapshots dated
    to a month, so a day narrows nothing, and the answer is the latest snapshot at that date rather than
    a statement of which boundaries were legally in force.
    `previous` and `next` are the neighbouring releases covering the same country; a change after the
    selected release shows first in `next`. `sameMonth` is true when the date falls in the release's own
    month, so a change that month may lie either side of it. `notCovering` lists later releases passed
    over because they miss the country.
    Releases of the same month are told apart only where one is plainly better: a subset derived from
    another is set aside for its source, and without `country` a release covering fewer countries is set
    aside. Each is listed in `setAside` with its reason. A deprecated release is never chosen while its
    replacement, which is not itself deprecated, is dated on or before the date and covers the country;
    it is set aside for it. Where no such replacement applies the deprecated release is chosen, and the
    response carries its `Deprecation` headers. Variants differing in any other way, such as clipping,
    are a 409 listing each in `choices`.

    Args:
        geography (str):
        date (str):
        country (ResolveBoundaryReleaseForDateCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ResolveBoundaryReleaseForDateResponse200]
    """

    kwargs = _get_kwargs(
        geography=geography,
        date=date,
        country=country,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    date: str,
    country: ResolveBoundaryReleaseForDateCountry | Unset = UNSET,
) -> Problem | ResolveBoundaryReleaseForDateResponse200 | None:
    """Select the boundary release to use for a date

     Returns the latest release of a geography dated on or before `date` that covers `country` when one
    is given, as an exact release id rather than a moving `latest` alias. Releases are snapshots dated
    to a month, so a day narrows nothing, and the answer is the latest snapshot at that date rather than
    a statement of which boundaries were legally in force.
    `previous` and `next` are the neighbouring releases covering the same country; a change after the
    selected release shows first in `next`. `sameMonth` is true when the date falls in the release's own
    month, so a change that month may lie either side of it. `notCovering` lists later releases passed
    over because they miss the country.
    Releases of the same month are told apart only where one is plainly better: a subset derived from
    another is set aside for its source, and without `country` a release covering fewer countries is set
    aside. Each is listed in `setAside` with its reason. A deprecated release is never chosen while its
    replacement, which is not itself deprecated, is dated on or before the date and covers the country;
    it is set aside for it. Where no such replacement applies the deprecated release is chosen, and the
    response carries its `Deprecation` headers. Variants differing in any other way, such as clipping,
    are a 409 listing each in `choices`.

    Args:
        geography (str):
        date (str):
        country (ResolveBoundaryReleaseForDateCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ResolveBoundaryReleaseForDateResponse200
    """

    return sync_detailed(
        client=client,
        geography=geography,
        date=date,
        country=country,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    date: str,
    country: ResolveBoundaryReleaseForDateCountry | Unset = UNSET,
) -> Response[Problem | ResolveBoundaryReleaseForDateResponse200]:
    """Select the boundary release to use for a date

     Returns the latest release of a geography dated on or before `date` that covers `country` when one
    is given, as an exact release id rather than a moving `latest` alias. Releases are snapshots dated
    to a month, so a day narrows nothing, and the answer is the latest snapshot at that date rather than
    a statement of which boundaries were legally in force.
    `previous` and `next` are the neighbouring releases covering the same country; a change after the
    selected release shows first in `next`. `sameMonth` is true when the date falls in the release's own
    month, so a change that month may lie either side of it. `notCovering` lists later releases passed
    over because they miss the country.
    Releases of the same month are told apart only where one is plainly better: a subset derived from
    another is set aside for its source, and without `country` a release covering fewer countries is set
    aside. Each is listed in `setAside` with its reason. A deprecated release is never chosen while its
    replacement, which is not itself deprecated, is dated on or before the date and covers the country;
    it is set aside for it. Where no such replacement applies the deprecated release is chosen, and the
    response carries its `Deprecation` headers. Variants differing in any other way, such as clipping,
    are a 409 listing each in `choices`.

    Args:
        geography (str):
        date (str):
        country (ResolveBoundaryReleaseForDateCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ResolveBoundaryReleaseForDateResponse200]
    """

    kwargs = _get_kwargs(
        geography=geography,
        date=date,
        country=country,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    geography: str,
    date: str,
    country: ResolveBoundaryReleaseForDateCountry | Unset = UNSET,
) -> Problem | ResolveBoundaryReleaseForDateResponse200 | None:
    """Select the boundary release to use for a date

     Returns the latest release of a geography dated on or before `date` that covers `country` when one
    is given, as an exact release id rather than a moving `latest` alias. Releases are snapshots dated
    to a month, so a day narrows nothing, and the answer is the latest snapshot at that date rather than
    a statement of which boundaries were legally in force.
    `previous` and `next` are the neighbouring releases covering the same country; a change after the
    selected release shows first in `next`. `sameMonth` is true when the date falls in the release's own
    month, so a change that month may lie either side of it. `notCovering` lists later releases passed
    over because they miss the country.
    Releases of the same month are told apart only where one is plainly better: a subset derived from
    another is set aside for its source, and without `country` a release covering fewer countries is set
    aside. Each is listed in `setAside` with its reason. A deprecated release is never chosen while its
    replacement, which is not itself deprecated, is dated on or before the date and covers the country;
    it is set aside for it. Where no such replacement applies the deprecated release is chosen, and the
    response carries its `Deprecation` headers. Variants differing in any other way, such as clipping,
    are a 409 listing each in `choices`.

    Args:
        geography (str):
        date (str):
        country (ResolveBoundaryReleaseForDateCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ResolveBoundaryReleaseForDateResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            geography=geography,
            date=date,
            country=country,
        )
    ).parsed
