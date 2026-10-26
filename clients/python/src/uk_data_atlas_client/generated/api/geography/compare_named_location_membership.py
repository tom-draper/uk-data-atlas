import datetime
from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.compare_named_location_membership_response_200 import (
    CompareNamedLocationMembershipResponse200,
)
from ...models.problem import Problem
from ...types import UNSET, Response


def _get_kwargs(
    location_id: str,
    *,
    from_: datetime.date,
    to: datetime.date,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    json_from_ = from_.isoformat()
    params["from"] = json_from_

    json_to = to.isoformat()
    params["to"] = json_to

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/locations/{location_id}/comparison".format(
            location_id=quote(str(location_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CompareNamedLocationMembershipResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = CompareNamedLocationMembershipResponse200.from_dict(
            response.json()
        )

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[CompareNamedLocationMembershipResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: datetime.date,
    to: datetime.date,
) -> Response[CompareNamedLocationMembershipResponse200 | Problem]:
    """Compare a named location's direct membership between two dates

    Args:
        location_id (str):
        from_ (datetime.date):
        to (datetime.date):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompareNamedLocationMembershipResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        from_=from_,
        to=to,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: datetime.date,
    to: datetime.date,
) -> CompareNamedLocationMembershipResponse200 | Problem | None:
    """Compare a named location's direct membership between two dates

    Args:
        location_id (str):
        from_ (datetime.date):
        to (datetime.date):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompareNamedLocationMembershipResponse200 | Problem
    """

    return sync_detailed(
        location_id=location_id,
        client=client,
        from_=from_,
        to=to,
    ).parsed


async def asyncio_detailed(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: datetime.date,
    to: datetime.date,
) -> Response[CompareNamedLocationMembershipResponse200 | Problem]:
    """Compare a named location's direct membership between two dates

    Args:
        location_id (str):
        from_ (datetime.date):
        to (datetime.date):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompareNamedLocationMembershipResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        location_id=location_id,
        from_=from_,
        to=to,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    location_id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: datetime.date,
    to: datetime.date,
) -> CompareNamedLocationMembershipResponse200 | Problem | None:
    """Compare a named location's direct membership between two dates

    Args:
        location_id (str):
        from_ (datetime.date):
        to (datetime.date):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompareNamedLocationMembershipResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            location_id=location_id,
            client=client,
            from_=from_,
            to=to,
        )
    ).parsed
