import datetime
from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...models.resolve_places_country import ResolvePlacesCountry
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    q: str,
    limit: int | Unset = 10,
    as_of: datetime.date | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    date: str | Unset = UNSET,
    country: ResolvePlacesCountry | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["q"] = q

    params["limit"] = limit

    json_as_of: str | Unset = UNSET
    if not isinstance(as_of, Unset):
        json_as_of = as_of.isoformat()
    params["asOf"] = json_as_of

    params["geography"] = geography

    params["release"] = release

    params["date"] = date

    json_country: str | Unset = UNSET
    if not isinstance(country, Unset):
        json_country = country.value

    params["country"] = json_country

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/places",
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
    q: str,
    limit: int | Unset = 10,
    as_of: datetime.date | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    date: str | Unset = UNSET,
    country: ResolvePlacesCountry | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Find every place a name could mean

     Turns a name into candidate places, each saying what kind of place it is. A name is rarely one area:
    "Manchester" is a local authority, a county and unitary authority, a major town, a travel to work
    area and a ward, and "Newport" is thirteen codes across Wales, the Isle of Wight and Shropshire.
    This never chooses among them.

    Names match with case, accents, punctuation and the ampersand set aside, so "Brighton & Hove" and
    "Ynys Mon" find what was published, and an alias matches as well as a name. An administrative title
    is set aside too, so "Bristol" finds the authority published as "Bristol, City of", reported as
    `exact-without-title`. Names that merely begin with the query follow, as `prefix`, once equal names
    leave room: "Richmond" lists its wards and parish first, then Richmond upon Thames. A bare area
    code, or a place reference, is looked up directly.

    A place held in several releases is returned once, with its releases newest first. Equal matches are
    listed headline geographies first, then wards and smaller areas; that is a presentation order and
    asserts nothing about which was meant. Curated named locations appear with their member codes, or
    the codes active on `asOf`.

    A unit postcode, typed in any case and with or without its space, leads the candidates as a place of
    its own: kind `postcode`, a place reference such as `postcode/SW1A1AA`, its centroid as `point`, and
    an `href` to `/postcodes/{postcode}`, which places it in areas. Nothing is placed here, so a search
    stays as fast as a name lookup. Pass the reference as `place` to `/data/{measure-id}/value` to
    answer a measure for the postcode. A query that reads as a postcode district or sector, or a unit
    postcode the directory does not hold or this API may not serve, carries a `postcodeHint` saying so.

    Add `geography` or `release` to resolve only exact area identities in that scope. `date`, with a
    geography, selects the latest published release on or before that date; `country` can narrow that
    selection.

    Args:
        q (str):
        limit (int | Unset):  Default: 10.
        as_of (datetime.date | Unset):
        geography (str | Unset):
        release (str | Unset):
        date (str | Unset):
        country (ResolvePlacesCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        q=q,
        limit=limit,
        as_of=as_of,
        geography=geography,
        release=release,
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
    q: str,
    limit: int | Unset = 10,
    as_of: datetime.date | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    date: str | Unset = UNSET,
    country: ResolvePlacesCountry | Unset = UNSET,
) -> Envelope | Problem | None:
    """Find every place a name could mean

     Turns a name into candidate places, each saying what kind of place it is. A name is rarely one area:
    "Manchester" is a local authority, a county and unitary authority, a major town, a travel to work
    area and a ward, and "Newport" is thirteen codes across Wales, the Isle of Wight and Shropshire.
    This never chooses among them.

    Names match with case, accents, punctuation and the ampersand set aside, so "Brighton & Hove" and
    "Ynys Mon" find what was published, and an alias matches as well as a name. An administrative title
    is set aside too, so "Bristol" finds the authority published as "Bristol, City of", reported as
    `exact-without-title`. Names that merely begin with the query follow, as `prefix`, once equal names
    leave room: "Richmond" lists its wards and parish first, then Richmond upon Thames. A bare area
    code, or a place reference, is looked up directly.

    A place held in several releases is returned once, with its releases newest first. Equal matches are
    listed headline geographies first, then wards and smaller areas; that is a presentation order and
    asserts nothing about which was meant. Curated named locations appear with their member codes, or
    the codes active on `asOf`.

    A unit postcode, typed in any case and with or without its space, leads the candidates as a place of
    its own: kind `postcode`, a place reference such as `postcode/SW1A1AA`, its centroid as `point`, and
    an `href` to `/postcodes/{postcode}`, which places it in areas. Nothing is placed here, so a search
    stays as fast as a name lookup. Pass the reference as `place` to `/data/{measure-id}/value` to
    answer a measure for the postcode. A query that reads as a postcode district or sector, or a unit
    postcode the directory does not hold or this API may not serve, carries a `postcodeHint` saying so.

    Add `geography` or `release` to resolve only exact area identities in that scope. `date`, with a
    geography, selects the latest published release on or before that date; `country` can narrow that
    selection.

    Args:
        q (str):
        limit (int | Unset):  Default: 10.
        as_of (datetime.date | Unset):
        geography (str | Unset):
        release (str | Unset):
        date (str | Unset):
        country (ResolvePlacesCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        client=client,
        q=q,
        limit=limit,
        as_of=as_of,
        geography=geography,
        release=release,
        date=date,
        country=country,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str,
    limit: int | Unset = 10,
    as_of: datetime.date | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    date: str | Unset = UNSET,
    country: ResolvePlacesCountry | Unset = UNSET,
) -> Response[Envelope | Problem]:
    """Find every place a name could mean

     Turns a name into candidate places, each saying what kind of place it is. A name is rarely one area:
    "Manchester" is a local authority, a county and unitary authority, a major town, a travel to work
    area and a ward, and "Newport" is thirteen codes across Wales, the Isle of Wight and Shropshire.
    This never chooses among them.

    Names match with case, accents, punctuation and the ampersand set aside, so "Brighton & Hove" and
    "Ynys Mon" find what was published, and an alias matches as well as a name. An administrative title
    is set aside too, so "Bristol" finds the authority published as "Bristol, City of", reported as
    `exact-without-title`. Names that merely begin with the query follow, as `prefix`, once equal names
    leave room: "Richmond" lists its wards and parish first, then Richmond upon Thames. A bare area
    code, or a place reference, is looked up directly.

    A place held in several releases is returned once, with its releases newest first. Equal matches are
    listed headline geographies first, then wards and smaller areas; that is a presentation order and
    asserts nothing about which was meant. Curated named locations appear with their member codes, or
    the codes active on `asOf`.

    A unit postcode, typed in any case and with or without its space, leads the candidates as a place of
    its own: kind `postcode`, a place reference such as `postcode/SW1A1AA`, its centroid as `point`, and
    an `href` to `/postcodes/{postcode}`, which places it in areas. Nothing is placed here, so a search
    stays as fast as a name lookup. Pass the reference as `place` to `/data/{measure-id}/value` to
    answer a measure for the postcode. A query that reads as a postcode district or sector, or a unit
    postcode the directory does not hold or this API may not serve, carries a `postcodeHint` saying so.

    Add `geography` or `release` to resolve only exact area identities in that scope. `date`, with a
    geography, selects the latest published release on or before that date; `country` can narrow that
    selection.

    Args:
        q (str):
        limit (int | Unset):  Default: 10.
        as_of (datetime.date | Unset):
        geography (str | Unset):
        release (str | Unset):
        date (str | Unset):
        country (ResolvePlacesCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        q=q,
        limit=limit,
        as_of=as_of,
        geography=geography,
        release=release,
        date=date,
        country=country,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    q: str,
    limit: int | Unset = 10,
    as_of: datetime.date | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    date: str | Unset = UNSET,
    country: ResolvePlacesCountry | Unset = UNSET,
) -> Envelope | Problem | None:
    """Find every place a name could mean

     Turns a name into candidate places, each saying what kind of place it is. A name is rarely one area:
    "Manchester" is a local authority, a county and unitary authority, a major town, a travel to work
    area and a ward, and "Newport" is thirteen codes across Wales, the Isle of Wight and Shropshire.
    This never chooses among them.

    Names match with case, accents, punctuation and the ampersand set aside, so "Brighton & Hove" and
    "Ynys Mon" find what was published, and an alias matches as well as a name. An administrative title
    is set aside too, so "Bristol" finds the authority published as "Bristol, City of", reported as
    `exact-without-title`. Names that merely begin with the query follow, as `prefix`, once equal names
    leave room: "Richmond" lists its wards and parish first, then Richmond upon Thames. A bare area
    code, or a place reference, is looked up directly.

    A place held in several releases is returned once, with its releases newest first. Equal matches are
    listed headline geographies first, then wards and smaller areas; that is a presentation order and
    asserts nothing about which was meant. Curated named locations appear with their member codes, or
    the codes active on `asOf`.

    A unit postcode, typed in any case and with or without its space, leads the candidates as a place of
    its own: kind `postcode`, a place reference such as `postcode/SW1A1AA`, its centroid as `point`, and
    an `href` to `/postcodes/{postcode}`, which places it in areas. Nothing is placed here, so a search
    stays as fast as a name lookup. Pass the reference as `place` to `/data/{measure-id}/value` to
    answer a measure for the postcode. A query that reads as a postcode district or sector, or a unit
    postcode the directory does not hold or this API may not serve, carries a `postcodeHint` saying so.

    Add `geography` or `release` to resolve only exact area identities in that scope. `date`, with a
    geography, selects the latest published release on or before that date; `country` can narrow that
    selection.

    Args:
        q (str):
        limit (int | Unset):  Default: 10.
        as_of (datetime.date | Unset):
        geography (str | Unset):
        release (str | Unset):
        date (str | Unset):
        country (ResolvePlacesCountry | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            q=q,
            limit=limit,
            as_of=as_of,
            geography=geography,
            release=release,
            date=date,
            country=country,
        )
    ).parsed
