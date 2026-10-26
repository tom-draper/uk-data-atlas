from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.postcode_lookup_envelope import PostcodeLookupEnvelope
from ...models.problem import Problem
from ...models.resolve_postcode_view import ResolvePostcodeView
from ...types import UNSET, Response, Unset


def _get_kwargs(
    postcode: str,
    *,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodeView | Unset = ResolvePostcodeView.FULL,
) -> dict[str, Any]:

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
        "method": "get",
        "url": "/postcodes/{postcode}".format(
            postcode=quote(str(postcode), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> PostcodeLookupEnvelope | Problem | None:
    if response.status_code == 200:
        response_200 = PostcodeLookupEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 451:
        response_451 = Problem.from_dict(response.json())

        return response_451

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[PostcodeLookupEnvelope | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    postcode: str,
    *,
    client: AuthenticatedClient | Client,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodeView | Unset = ResolvePostcodeView.FULL,
) -> Response[PostcodeLookupEnvelope | Problem]:
    """Find where a postcode is and the areas containing it

     Looks a unit postcode up in the ONS Postcode Directory and places its centroid in each requested
    geography, through the same point lookup as `/areas:contains`. The postcode is read in any case,
    with or without its space.

    With no `geography` or `release`, the postcode is placed in its local authority, ward and
    Westminster constituency. With no `date`, each release is the latest dated on or before the
    directory's edition, and `dateBasis` says which was used. Terminated postcodes are served, with the
    month they were terminated.

    A postcode is placed by a single centroid, and its addresses can fall on both sides of a boundary.
    The centroid's positional quality comes from the directory; where the directory states an accuracy
    it becomes the point's uncertainty and counts towards `positionalToleranceM`. Where it does not, as
    for centroids ONS imputed or set at a postcode sector's mean, `caution` says that `nearBoundary` may
    understate the risk. A postcode with no grid reference, such as one in the Channel Islands or the
    Isle of Man, is described but placed in no area.

    Northern Ireland postcodes are licensed by Land and Property Services for internal business use only
    and are refused with 451. The source's required attribution is returned with every answer.

    `view=compact` returns only the postcode, its WGS 84 point, each area it is placed in and the
    attribution, for callers that do not need the provenance and tolerances; it is a fraction of the
    size.

    Args:
        postcode (str):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodeView | Unset):  Default: ResolvePostcodeView.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostcodeLookupEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        postcode=postcode,
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
    postcode: str,
    *,
    client: AuthenticatedClient | Client,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodeView | Unset = ResolvePostcodeView.FULL,
) -> PostcodeLookupEnvelope | Problem | None:
    """Find where a postcode is and the areas containing it

     Looks a unit postcode up in the ONS Postcode Directory and places its centroid in each requested
    geography, through the same point lookup as `/areas:contains`. The postcode is read in any case,
    with or without its space.

    With no `geography` or `release`, the postcode is placed in its local authority, ward and
    Westminster constituency. With no `date`, each release is the latest dated on or before the
    directory's edition, and `dateBasis` says which was used. Terminated postcodes are served, with the
    month they were terminated.

    A postcode is placed by a single centroid, and its addresses can fall on both sides of a boundary.
    The centroid's positional quality comes from the directory; where the directory states an accuracy
    it becomes the point's uncertainty and counts towards `positionalToleranceM`. Where it does not, as
    for centroids ONS imputed or set at a postcode sector's mean, `caution` says that `nearBoundary` may
    understate the risk. A postcode with no grid reference, such as one in the Channel Islands or the
    Isle of Man, is described but placed in no area.

    Northern Ireland postcodes are licensed by Land and Property Services for internal business use only
    and are refused with 451. The source's required attribution is returned with every answer.

    `view=compact` returns only the postcode, its WGS 84 point, each area it is placed in and the
    attribution, for callers that do not need the provenance and tolerances; it is a fraction of the
    size.

    Args:
        postcode (str):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodeView | Unset):  Default: ResolvePostcodeView.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostcodeLookupEnvelope | Problem
    """

    return sync_detailed(
        postcode=postcode,
        client=client,
        geography=geography,
        release=release,
        date=date,
        view=view,
    ).parsed


async def asyncio_detailed(
    postcode: str,
    *,
    client: AuthenticatedClient | Client,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodeView | Unset = ResolvePostcodeView.FULL,
) -> Response[PostcodeLookupEnvelope | Problem]:
    """Find where a postcode is and the areas containing it

     Looks a unit postcode up in the ONS Postcode Directory and places its centroid in each requested
    geography, through the same point lookup as `/areas:contains`. The postcode is read in any case,
    with or without its space.

    With no `geography` or `release`, the postcode is placed in its local authority, ward and
    Westminster constituency. With no `date`, each release is the latest dated on or before the
    directory's edition, and `dateBasis` says which was used. Terminated postcodes are served, with the
    month they were terminated.

    A postcode is placed by a single centroid, and its addresses can fall on both sides of a boundary.
    The centroid's positional quality comes from the directory; where the directory states an accuracy
    it becomes the point's uncertainty and counts towards `positionalToleranceM`. Where it does not, as
    for centroids ONS imputed or set at a postcode sector's mean, `caution` says that `nearBoundary` may
    understate the risk. A postcode with no grid reference, such as one in the Channel Islands or the
    Isle of Man, is described but placed in no area.

    Northern Ireland postcodes are licensed by Land and Property Services for internal business use only
    and are refused with 451. The source's required attribution is returned with every answer.

    `view=compact` returns only the postcode, its WGS 84 point, each area it is placed in and the
    attribution, for callers that do not need the provenance and tolerances; it is a fraction of the
    size.

    Args:
        postcode (str):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodeView | Unset):  Default: ResolvePostcodeView.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PostcodeLookupEnvelope | Problem]
    """

    kwargs = _get_kwargs(
        postcode=postcode,
        geography=geography,
        release=release,
        date=date,
        view=view,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    postcode: str,
    *,
    client: AuthenticatedClient | Client,
    geography: list[str] | Unset = UNSET,
    release: list[str] | Unset = UNSET,
    date: str | Unset = UNSET,
    view: ResolvePostcodeView | Unset = ResolvePostcodeView.FULL,
) -> PostcodeLookupEnvelope | Problem | None:
    """Find where a postcode is and the areas containing it

     Looks a unit postcode up in the ONS Postcode Directory and places its centroid in each requested
    geography, through the same point lookup as `/areas:contains`. The postcode is read in any case,
    with or without its space.

    With no `geography` or `release`, the postcode is placed in its local authority, ward and
    Westminster constituency. With no `date`, each release is the latest dated on or before the
    directory's edition, and `dateBasis` says which was used. Terminated postcodes are served, with the
    month they were terminated.

    A postcode is placed by a single centroid, and its addresses can fall on both sides of a boundary.
    The centroid's positional quality comes from the directory; where the directory states an accuracy
    it becomes the point's uncertainty and counts towards `positionalToleranceM`. Where it does not, as
    for centroids ONS imputed or set at a postcode sector's mean, `caution` says that `nearBoundary` may
    understate the risk. A postcode with no grid reference, such as one in the Channel Islands or the
    Isle of Man, is described but placed in no area.

    Northern Ireland postcodes are licensed by Land and Property Services for internal business use only
    and are refused with 451. The source's required attribution is returned with every answer.

    `view=compact` returns only the postcode, its WGS 84 point, each area it is placed in and the
    attribution, for callers that do not need the provenance and tolerances; it is a fraction of the
    size.

    Args:
        postcode (str):
        geography (list[str] | Unset):
        release (list[str] | Unset):
        date (str | Unset):
        view (ResolvePostcodeView | Unset):  Default: ResolvePostcodeView.FULL.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PostcodeLookupEnvelope | Problem
    """

    return (
        await asyncio_detailed(
            postcode=postcode,
            client=client,
            geography=geography,
            release=release,
            date=date,
            view=view,
        )
    ).parsed
