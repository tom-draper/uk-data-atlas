from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.place_not_served_problem import PlaceNotServedProblem
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    place: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    code_year: str | Unset = UNSET,
    period: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["place"] = place

    params["postcode"] = postcode

    params["geography"] = geography

    params["codeYear"] = code_year

    params["period"] = period

    params["datasetId"] = dataset_id

    params["from"] = from_

    params["crosswalk"] = crosswalk

    params["path"] = path

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}/value".format(
            measure_id=quote(str(measure_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Envelope | PlaceNotServedProblem | Problem | None:
    if response.status_code == 200:
        response_200 = Envelope.from_dict(response.json())

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

    if response.status_code == 422:
        response_422 = PlaceNotServedProblem.from_dict(response.json())

        return response_422

    if response.status_code == 503:
        response_503 = Problem.from_dict(response.json())

        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Envelope | PlaceNotServedProblem | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    code_year: str | Unset = UNSET,
    period: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
) -> Response[Envelope | PlaceNotServedProblem | Problem]:
    """Answer a measure for a place by name (by-place dispatcher)

     A deliberately narrow convenience for a place-name question, not the primary way to fetch one
    observation: it resolves the name and dispatches to a route that already serves that kind of place.
    Ask `/data/{measure-id}` for observations, or `/data/{measure-id}/series` for one area's values,
    when the area is already known.

    It answers "what is the population of the North West?" in one call. The place may be a name, an area
    code or a place reference from `/places`; the period may be omitted, in which case the latest the
    chosen partition publishes is used and the answer says so. Where a name may mean several places,
    `GET /v1/places?q=Newport` lists them first, and a candidate's place reference asks about that one
    alone: `GET /v1/data/population/value?place=localAuthority/W06000022`.

    Nothing is computed here. Each place the name could mean is put to the route that already serves
    that kind of place: `series` for an area, `aggregate` for a curated location or a country. The
    value, its provenance and every refusal are exactly what that route gives, and `via` names the call
    that gives the answer directly, for citing or repeating.

    The candidate is chosen by what the measure can answer rather than by guessing what was meant.
    Places matching the name exactly are tried first; names merely beginning with it only when no exact
    match answers. Answers resting on the same partition, period and area codes are the same ground
    reached two ways and count once, keeping the publisher's own observation over an aggregate of one
    member: Manchester the authority and Manchester the curated location of that authority give one
    answer. The other places the name matched are listed in `otherMatches`, answered or not.

    When the name gives more than one distinct answer, the usual geography tier chooses the most likely
    match. `question.placeDefaulted` says this happened and `otherMatches` lists every alternative with
    its answer or refusal. "Newport", for example, defaults to the Welsh authority over wards of the
    same name. When the name matches places but the measure answers none, the response is a 422 with a
    `candidates` member saying why for each, such as a median, which cannot be summed over a region.

    Give `postcode` instead of `place` to answer for where a unit postcode is: `GET /v1/data/imd-
    decile/value?postcode=M1 1AE`. The postcode's centroid is placed in the areas the data was published
    for, as drawn for the data's own boundary year rather than today's, in a boundary release holding
    that partition's codes; `boundaryMatch` names it. With no `geography`, the finest geography the
    measure is published on is tried first, and a coarser one only where a finer does not cover the
    postcode's country or has no value there; `passedOver` says why, and `otherGeographies` gives the
    request for each other geography. A centroid on a shared boundary whose areas answer differently is
    a 409 with `choices`, and a postcode no geography answers is a 422 with a `candidates` member saying
    why for each.

    Args:
        measure_id (str):
        place (str | Unset):
        postcode (str | Unset):
        geography (str | Unset):
        code_year (str | Unset):
        period (str | Unset):
        dataset_id (str | Unset):
        from_ (str | Unset):
        crosswalk (str | Unset):
        path (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | PlaceNotServedProblem | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        place=place,
        postcode=postcode,
        geography=geography,
        code_year=code_year,
        period=period,
        dataset_id=dataset_id,
        from_=from_,
        crosswalk=crosswalk,
        path=path,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    code_year: str | Unset = UNSET,
    period: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
) -> Envelope | PlaceNotServedProblem | Problem | None:
    """Answer a measure for a place by name (by-place dispatcher)

     A deliberately narrow convenience for a place-name question, not the primary way to fetch one
    observation: it resolves the name and dispatches to a route that already serves that kind of place.
    Ask `/data/{measure-id}` for observations, or `/data/{measure-id}/series` for one area's values,
    when the area is already known.

    It answers "what is the population of the North West?" in one call. The place may be a name, an area
    code or a place reference from `/places`; the period may be omitted, in which case the latest the
    chosen partition publishes is used and the answer says so. Where a name may mean several places,
    `GET /v1/places?q=Newport` lists them first, and a candidate's place reference asks about that one
    alone: `GET /v1/data/population/value?place=localAuthority/W06000022`.

    Nothing is computed here. Each place the name could mean is put to the route that already serves
    that kind of place: `series` for an area, `aggregate` for a curated location or a country. The
    value, its provenance and every refusal are exactly what that route gives, and `via` names the call
    that gives the answer directly, for citing or repeating.

    The candidate is chosen by what the measure can answer rather than by guessing what was meant.
    Places matching the name exactly are tried first; names merely beginning with it only when no exact
    match answers. Answers resting on the same partition, period and area codes are the same ground
    reached two ways and count once, keeping the publisher's own observation over an aggregate of one
    member: Manchester the authority and Manchester the curated location of that authority give one
    answer. The other places the name matched are listed in `otherMatches`, answered or not.

    When the name gives more than one distinct answer, the usual geography tier chooses the most likely
    match. `question.placeDefaulted` says this happened and `otherMatches` lists every alternative with
    its answer or refusal. "Newport", for example, defaults to the Welsh authority over wards of the
    same name. When the name matches places but the measure answers none, the response is a 422 with a
    `candidates` member saying why for each, such as a median, which cannot be summed over a region.

    Give `postcode` instead of `place` to answer for where a unit postcode is: `GET /v1/data/imd-
    decile/value?postcode=M1 1AE`. The postcode's centroid is placed in the areas the data was published
    for, as drawn for the data's own boundary year rather than today's, in a boundary release holding
    that partition's codes; `boundaryMatch` names it. With no `geography`, the finest geography the
    measure is published on is tried first, and a coarser one only where a finer does not cover the
    postcode's country or has no value there; `passedOver` says why, and `otherGeographies` gives the
    request for each other geography. A centroid on a shared boundary whose areas answer differently is
    a 409 with `choices`, and a postcode no geography answers is a 422 with a `candidates` member saying
    why for each.

    Args:
        measure_id (str):
        place (str | Unset):
        postcode (str | Unset):
        geography (str | Unset):
        code_year (str | Unset):
        period (str | Unset):
        dataset_id (str | Unset):
        from_ (str | Unset):
        crosswalk (str | Unset):
        path (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | PlaceNotServedProblem | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        place=place,
        postcode=postcode,
        geography=geography,
        code_year=code_year,
        period=period,
        dataset_id=dataset_id,
        from_=from_,
        crosswalk=crosswalk,
        path=path,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    code_year: str | Unset = UNSET,
    period: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
) -> Response[Envelope | PlaceNotServedProblem | Problem]:
    """Answer a measure for a place by name (by-place dispatcher)

     A deliberately narrow convenience for a place-name question, not the primary way to fetch one
    observation: it resolves the name and dispatches to a route that already serves that kind of place.
    Ask `/data/{measure-id}` for observations, or `/data/{measure-id}/series` for one area's values,
    when the area is already known.

    It answers "what is the population of the North West?" in one call. The place may be a name, an area
    code or a place reference from `/places`; the period may be omitted, in which case the latest the
    chosen partition publishes is used and the answer says so. Where a name may mean several places,
    `GET /v1/places?q=Newport` lists them first, and a candidate's place reference asks about that one
    alone: `GET /v1/data/population/value?place=localAuthority/W06000022`.

    Nothing is computed here. Each place the name could mean is put to the route that already serves
    that kind of place: `series` for an area, `aggregate` for a curated location or a country. The
    value, its provenance and every refusal are exactly what that route gives, and `via` names the call
    that gives the answer directly, for citing or repeating.

    The candidate is chosen by what the measure can answer rather than by guessing what was meant.
    Places matching the name exactly are tried first; names merely beginning with it only when no exact
    match answers. Answers resting on the same partition, period and area codes are the same ground
    reached two ways and count once, keeping the publisher's own observation over an aggregate of one
    member: Manchester the authority and Manchester the curated location of that authority give one
    answer. The other places the name matched are listed in `otherMatches`, answered or not.

    When the name gives more than one distinct answer, the usual geography tier chooses the most likely
    match. `question.placeDefaulted` says this happened and `otherMatches` lists every alternative with
    its answer or refusal. "Newport", for example, defaults to the Welsh authority over wards of the
    same name. When the name matches places but the measure answers none, the response is a 422 with a
    `candidates` member saying why for each, such as a median, which cannot be summed over a region.

    Give `postcode` instead of `place` to answer for where a unit postcode is: `GET /v1/data/imd-
    decile/value?postcode=M1 1AE`. The postcode's centroid is placed in the areas the data was published
    for, as drawn for the data's own boundary year rather than today's, in a boundary release holding
    that partition's codes; `boundaryMatch` names it. With no `geography`, the finest geography the
    measure is published on is tried first, and a coarser one only where a finer does not cover the
    postcode's country or has no value there; `passedOver` says why, and `otherGeographies` gives the
    request for each other geography. A centroid on a shared boundary whose areas answer differently is
    a 409 with `choices`, and a postcode no geography answers is a 422 with a `candidates` member saying
    why for each.

    Args:
        measure_id (str):
        place (str | Unset):
        postcode (str | Unset):
        geography (str | Unset):
        code_year (str | Unset):
        period (str | Unset):
        dataset_id (str | Unset):
        from_ (str | Unset):
        crosswalk (str | Unset):
        path (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | PlaceNotServedProblem | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        place=place,
        postcode=postcode,
        geography=geography,
        code_year=code_year,
        period=period,
        dataset_id=dataset_id,
        from_=from_,
        crosswalk=crosswalk,
        path=path,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    place: str | Unset = UNSET,
    postcode: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    code_year: str | Unset = UNSET,
    period: str | Unset = UNSET,
    dataset_id: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    crosswalk: str | Unset = UNSET,
    path: str | Unset = UNSET,
) -> Envelope | PlaceNotServedProblem | Problem | None:
    """Answer a measure for a place by name (by-place dispatcher)

     A deliberately narrow convenience for a place-name question, not the primary way to fetch one
    observation: it resolves the name and dispatches to a route that already serves that kind of place.
    Ask `/data/{measure-id}` for observations, or `/data/{measure-id}/series` for one area's values,
    when the area is already known.

    It answers "what is the population of the North West?" in one call. The place may be a name, an area
    code or a place reference from `/places`; the period may be omitted, in which case the latest the
    chosen partition publishes is used and the answer says so. Where a name may mean several places,
    `GET /v1/places?q=Newport` lists them first, and a candidate's place reference asks about that one
    alone: `GET /v1/data/population/value?place=localAuthority/W06000022`.

    Nothing is computed here. Each place the name could mean is put to the route that already serves
    that kind of place: `series` for an area, `aggregate` for a curated location or a country. The
    value, its provenance and every refusal are exactly what that route gives, and `via` names the call
    that gives the answer directly, for citing or repeating.

    The candidate is chosen by what the measure can answer rather than by guessing what was meant.
    Places matching the name exactly are tried first; names merely beginning with it only when no exact
    match answers. Answers resting on the same partition, period and area codes are the same ground
    reached two ways and count once, keeping the publisher's own observation over an aggregate of one
    member: Manchester the authority and Manchester the curated location of that authority give one
    answer. The other places the name matched are listed in `otherMatches`, answered or not.

    When the name gives more than one distinct answer, the usual geography tier chooses the most likely
    match. `question.placeDefaulted` says this happened and `otherMatches` lists every alternative with
    its answer or refusal. "Newport", for example, defaults to the Welsh authority over wards of the
    same name. When the name matches places but the measure answers none, the response is a 422 with a
    `candidates` member saying why for each, such as a median, which cannot be summed over a region.

    Give `postcode` instead of `place` to answer for where a unit postcode is: `GET /v1/data/imd-
    decile/value?postcode=M1 1AE`. The postcode's centroid is placed in the areas the data was published
    for, as drawn for the data's own boundary year rather than today's, in a boundary release holding
    that partition's codes; `boundaryMatch` names it. With no `geography`, the finest geography the
    measure is published on is tried first, and a coarser one only where a finer does not cover the
    postcode's country or has no value there; `passedOver` says why, and `otherGeographies` gives the
    request for each other geography. A centroid on a shared boundary whose areas answer differently is
    a 409 with `choices`, and a postcode no geography answers is a 422 with a `candidates` member saying
    why for each.

    Args:
        measure_id (str):
        place (str | Unset):
        postcode (str | Unset):
        geography (str | Unset):
        code_year (str | Unset):
        period (str | Unset):
        dataset_id (str | Unset):
        from_ (str | Unset):
        crosswalk (str | Unset):
        path (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | PlaceNotServedProblem | Problem
    """

    return (
        await asyncio_detailed(
            measure_id=measure_id,
            client=client,
            place=place,
            postcode=postcode,
            geography=geography,
            code_year=code_year,
            period=period,
            dataset_id=dataset_id,
            from_=from_,
            crosswalk=crosswalk,
            path=path,
        )
    ).parsed
