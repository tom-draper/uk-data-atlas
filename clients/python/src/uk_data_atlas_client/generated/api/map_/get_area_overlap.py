from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...types import UNSET, Response


def _get_kwargs(
    geography: str,
    release: str,
    code: str,
    *,
    place: str,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["place"] = place

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{release}/{code}/overlap".format(
            geography=quote(str(geography), safe=""),
            release=quote(str(release), safe=""),
            code=quote(str(code), safe=""),
        ),
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
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    place: str,
) -> Response[Envelope | Problem]:
    """Measure how one area overlaps another

     Intersects this area with the area named in `place`, which may be of another geography or boundary
    release, and returns the shared area, each area's share of it, and a relation, so a constituency and
    a local authority can be compared without downloading either geometry.
    The relation follows the rules the published area-overlap crosswalks are compiled with, stated in
    `method`. The intersection is judged by its widest piece: narrower than `sliverWidthM` it is where
    two independently generalised borders disagree, and the relation is `boundary-only`; within a factor
    of two of that width it is `indeterminate`, because a crosswalk compile would refuse to decide.
    Otherwise an area covered to `minimumCoverage` is `within` the other, the other `contains` it, both
    covered is `same-extent`, and anything else `overlaps`. Areas that do not meet are `disjoint`.
    This measures the generalised boundaries as published and is not an official statement of how the
    areas relate. `publishedRelationships` lists any published crosswalk relationship between the two,
    with its method and quality. The other release may be `latest`; the response records that selection
    beside the second area.

    Args:
        geography (str):
        release (str):
        code (str):
        place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        place=place,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    place: str,
) -> Envelope | Problem | None:
    """Measure how one area overlaps another

     Intersects this area with the area named in `place`, which may be of another geography or boundary
    release, and returns the shared area, each area's share of it, and a relation, so a constituency and
    a local authority can be compared without downloading either geometry.
    The relation follows the rules the published area-overlap crosswalks are compiled with, stated in
    `method`. The intersection is judged by its widest piece: narrower than `sliverWidthM` it is where
    two independently generalised borders disagree, and the relation is `boundary-only`; within a factor
    of two of that width it is `indeterminate`, because a crosswalk compile would refuse to decide.
    Otherwise an area covered to `minimumCoverage` is `within` the other, the other `contains` it, both
    covered is `same-extent`, and anything else `overlaps`. Areas that do not meet are `disjoint`.
    This measures the generalised boundaries as published and is not an official statement of how the
    areas relate. `publishedRelationships` lists any published crosswalk relationship between the two,
    with its method and quality. The other release may be `latest`; the response records that selection
    beside the second area.

    Args:
        geography (str):
        release (str):
        code (str):
        place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        geography=geography,
        release=release,
        code=code,
        client=client,
        place=place,
    ).parsed


async def asyncio_detailed(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    place: str,
) -> Response[Envelope | Problem]:
    """Measure how one area overlaps another

     Intersects this area with the area named in `place`, which may be of another geography or boundary
    release, and returns the shared area, each area's share of it, and a relation, so a constituency and
    a local authority can be compared without downloading either geometry.
    The relation follows the rules the published area-overlap crosswalks are compiled with, stated in
    `method`. The intersection is judged by its widest piece: narrower than `sliverWidthM` it is where
    two independently generalised borders disagree, and the relation is `boundary-only`; within a factor
    of two of that width it is `indeterminate`, because a crosswalk compile would refuse to decide.
    Otherwise an area covered to `minimumCoverage` is `within` the other, the other `contains` it, both
    covered is `same-extent`, and anything else `overlaps`. Areas that do not meet are `disjoint`.
    This measures the generalised boundaries as published and is not an official statement of how the
    areas relate. `publishedRelationships` lists any published crosswalk relationship between the two,
    with its method and quality. The other release may be `latest`; the response records that selection
    beside the second area.

    Args:
        geography (str):
        release (str):
        code (str):
        place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        code=code,
        place=place,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    release: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    place: str,
) -> Envelope | Problem | None:
    """Measure how one area overlaps another

     Intersects this area with the area named in `place`, which may be of another geography or boundary
    release, and returns the shared area, each area's share of it, and a relation, so a constituency and
    a local authority can be compared without downloading either geometry.
    The relation follows the rules the published area-overlap crosswalks are compiled with, stated in
    `method`. The intersection is judged by its widest piece: narrower than `sliverWidthM` it is where
    two independently generalised borders disagree, and the relation is `boundary-only`; within a factor
    of two of that width it is `indeterminate`, because a crosswalk compile would refuse to decide.
    Otherwise an area covered to `minimumCoverage` is `within` the other, the other `contains` it, both
    covered is `same-extent`, and anything else `overlaps`. Areas that do not meet are `disjoint`.
    This measures the generalised boundaries as published and is not an official statement of how the
    areas relate. `publishedRelationships` lists any published crosswalk relationship between the two,
    with its method and quality. The other release may be `latest`; the response records that selection
    beside the second area.

    Args:
        geography (str):
        release (str):
        code (str):
        place (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            release=release,
            code=code,
            client=client,
            place=place,
        )
    ).parsed
