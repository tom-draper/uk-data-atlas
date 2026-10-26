from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.postcode_batch_envelope import PostcodeBatchEnvelope
from ...models.problem import Problem
from ...models.resolve_postcodes_body import ResolvePostcodesBody
from ...models.resolve_postcodes_view import ResolvePostcodesView
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: ResolvePostcodesBody,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodesView | Unset = ResolvePostcodesView.FULL,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    json_geography: list[str] | Unset = UNSET
    if not isinstance(geography, Unset):
        json_geography = geography

    params["geography"] = json_geography

    json_release: list[str] | Unset = UNSET
    if not isinstance(release, Unset):
        json_release = release

    params["release"] = json_release

    params["date"] = date

    json_view: str | Unset = UNSET
    if not isinstance(view, Unset):
        json_view = view.value

    params["view"] = json_view

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/postcodes:batch",
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostcodeBatchEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = PostcodeBatchEnvelope.from_dict(response.json())

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
) -> Response[PostcodeBatchEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ResolvePostcodesBody,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodesView | Unset = ResolvePostcodesView.FULL,
) -> Response[PostcodeBatchEnvelope | Problem]:
    """Find where each of a batch of postcodes is and the areas containing it

     The `/postcodes/{postcode}` lookup for up to 100 postcodes at once. Send them in the JSON body's
    `postcodes` array. The releases are chosen once for the whole batch, as for a single postcode: the
    default geographies as at the directory's edition unless query `geography`, `release` or `date` say
    otherwise.

    Each postcode has its own entry, in the order given, with a `status`: `placed`, with its areas;
    `not-placed`, for a postcode the directory gives no grid reference; `invalid`, for text that is not
    a unit postcode; `not-found`, for one the directory edition does not hold; and `not-served`, for a
    Northern Ireland postcode, which this API is not licensed to serve. None of these fails the batch.
    Only a problem with the request itself does, such as no postcodes, too many, or a malformed date.

    Placed centroids are tested together, so each release's geometry is read once for the batch, and
    release-wide provenance is given once in `releases`. `summary` counts each postcode status and each
    lookup outcome. `view=compact` keeps the entries and summary but gives each postcode only its
    record, point and areas, as for a single postcode.

    Args:
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodesView | Unset):  Default: ResolvePostcodesView.FULL.
        body (ResolvePostcodesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostcodeBatchEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        body=body,
        geography=geography,
        release=release,
        date=date,
        view=view,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: ResolvePostcodesBody,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodesView | Unset = ResolvePostcodesView.FULL,
) -> PostcodeBatchEnvelope | Problem | None:
    """Find where each of a batch of postcodes is and the areas containing it

     The `/postcodes/{postcode}` lookup for up to 100 postcodes at once. Send them in the JSON body's
    `postcodes` array. The releases are chosen once for the whole batch, as for a single postcode: the
    default geographies as at the directory's edition unless query `geography`, `release` or `date` say
    otherwise.

    Each postcode has its own entry, in the order given, with a `status`: `placed`, with its areas;
    `not-placed`, for a postcode the directory gives no grid reference; `invalid`, for text that is not
    a unit postcode; `not-found`, for one the directory edition does not hold; and `not-served`, for a
    Northern Ireland postcode, which this API is not licensed to serve. None of these fails the batch.
    Only a problem with the request itself does, such as no postcodes, too many, or a malformed date.

    Placed centroids are tested together, so each release's geometry is read once for the batch, and
    release-wide provenance is given once in `releases`. `summary` counts each postcode status and each
    lookup outcome. `view=compact` keeps the entries and summary but gives each postcode only its
    record, point and areas, as for a single postcode.

    Args:
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodesView | Unset):  Default: ResolvePostcodesView.FULL.
        body (ResolvePostcodesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostcodeBatchEnvelope | Problem
    """

    return sync_detailed(
        client=client,
        body=body,
        geography=geography,
        release=release,
        date=date,
        view=view,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ResolvePostcodesBody,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodesView | Unset = ResolvePostcodesView.FULL,
) -> Response[PostcodeBatchEnvelope | Problem]:
    """Find where each of a batch of postcodes is and the areas containing it

     The `/postcodes/{postcode}` lookup for up to 100 postcodes at once. Send them in the JSON body's
    `postcodes` array. The releases are chosen once for the whole batch, as for a single postcode: the
    default geographies as at the directory's edition unless query `geography`, `release` or `date` say
    otherwise.

    Each postcode has its own entry, in the order given, with a `status`: `placed`, with its areas;
    `not-placed`, for a postcode the directory gives no grid reference; `invalid`, for text that is not
    a unit postcode; `not-found`, for one the directory edition does not hold; and `not-served`, for a
    Northern Ireland postcode, which this API is not licensed to serve. None of these fails the batch.
    Only a problem with the request itself does, such as no postcodes, too many, or a malformed date.

    Placed centroids are tested together, so each release's geometry is read once for the batch, and
    release-wide provenance is given once in `releases`. `summary` counts each postcode status and each
    lookup outcome. `view=compact` keeps the entries and summary but gives each postcode only its
    record, point and areas, as for a single postcode.

    Args:
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodesView | Unset):  Default: ResolvePostcodesView.FULL.
        body (ResolvePostcodesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostcodeBatchEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        body=body,
        geography=geography,
        release=release,
        date=date,
        view=view,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: ResolvePostcodesBody,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodesView | Unset = ResolvePostcodesView.FULL,
) -> PostcodeBatchEnvelope | Problem | None:
    """Find where each of a batch of postcodes is and the areas containing it

     The `/postcodes/{postcode}` lookup for up to 100 postcodes at once. Send them in the JSON body's
    `postcodes` array. The releases are chosen once for the whole batch, as for a single postcode: the
    default geographies as at the directory's edition unless query `geography`, `release` or `date` say
    otherwise.

    Each postcode has its own entry, in the order given, with a `status`: `placed`, with its areas;
    `not-placed`, for a postcode the directory gives no grid reference; `invalid`, for text that is not
    a unit postcode; `not-found`, for one the directory edition does not hold; and `not-served`, for a
    Northern Ireland postcode, which this API is not licensed to serve. None of these fails the batch.
    Only a problem with the request itself does, such as no postcodes, too many, or a malformed date.

    Placed centroids are tested together, so each release's geometry is read once for the batch, and
    release-wide provenance is given once in `releases`. `summary` counts each postcode status and each
    lookup outcome. `view=compact` keeps the entries and summary but gives each postcode only its
    record, point and areas, as for a single postcode.

    Args:
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodesView | Unset):  Default: ResolvePostcodesView.FULL.
        body (ResolvePostcodesBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostcodeBatchEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            geography=geography,
            release=release,
            date=date,
            view=view,
        )
    ).parsed
