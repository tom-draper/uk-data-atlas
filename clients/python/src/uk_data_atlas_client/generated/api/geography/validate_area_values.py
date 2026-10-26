from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.envelope import Envelope
from ...models.problem import Problem
from ...models.validate_area_values_format import ValidateAreaValuesFormat
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    value: list[str],
    parent: list[str] | Unset = UNSET,
    format_: ValidateAreaValuesFormat | Unset = ValidateAreaValuesFormat.JSON,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["geography"] = geography

    params["release"] = release

    json_value = value

    params["value"] = json_value

    json_parent: list[str] | Unset = UNSET
    if not isinstance(parent, Unset):
        json_parent = parent

    params["parent"] = json_parent

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas:validate",
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
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    value: list[str],
    parent: list[str] | Unset = UNSET,
    format_: ValidateAreaValuesFormat | Unset = ValidateAreaValuesFormat.JSON,
) -> Response[Envelope | Problem]:
    """Validate a batch of area codes or names, or infer their likely release

     With `geography` and `release`, checks each `value` against one exact boundary release before a
    caller joins data to it. Omit both to rank compiled geography/releases by exact resolutions and
    report the likely one; this is a diagnosis, never an automatic join or conversion. Where other
    releases resolve exactly as many values, the likely one is the newest of them and `likely.tiedWith`
    names the rest, since the values alone cannot tell them apart. At most 500 values may be sent in one
    GET; POST the column as JSON or CSV to send more.
    A value shaped like an area code is `valid` when the release holds it. Otherwise it is `superseded`
    or `not-yet-current` when only older or newer releases of the geography hold it, `absent-from-
    release` when releases on both sides do, `other-geography` when only another geography holds it,
    `unknown` when nothing does, and `malformed-code` when it is a letter followed by other than eight
    digits.
    Any other value is a name. It is `matched` only exactly, through a published alias, or with an
    administrative title such as "City of" set aside, never by prefix or similarity. A name meaning
    several areas is `ambiguous` and lists them all; an `unmatched` name lists the other releases of the
    geography where it does match.
    Repeat `parent` alongside `value` to settle a shared name with a parent code or name. It resolves
    only when exactly one candidate has a published containment relationship to that parent. Each result
    says in `normalised` whether the value was trimmed or re-cased to be read, and in `duplicateOf`
    whether it repeats an earlier value. `summary.joinable` is true only when every value names exactly
    one area of the release.
    Every JSON result carries a versioned matching manifest with the Atlas release, exact submitted
    values and their digest, candidate decision and published-path recommendations. Use `format=csv` to
    download the same row-preserving result for a local join or audit.

    Args:
        geography (str | Unset):
        release (str | Unset):
        value (list[str]):
        parent (list[str] | Unset):
        format_ (ValidateAreaValuesFormat | Unset):  Default: ValidateAreaValuesFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        value=value,
        parent=parent,
        format_=format_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    value: list[str],
    parent: list[str] | Unset = UNSET,
    format_: ValidateAreaValuesFormat | Unset = ValidateAreaValuesFormat.JSON,
) -> Envelope | Problem | None:
    """Validate a batch of area codes or names, or infer their likely release

     With `geography` and `release`, checks each `value` against one exact boundary release before a
    caller joins data to it. Omit both to rank compiled geography/releases by exact resolutions and
    report the likely one; this is a diagnosis, never an automatic join or conversion. Where other
    releases resolve exactly as many values, the likely one is the newest of them and `likely.tiedWith`
    names the rest, since the values alone cannot tell them apart. At most 500 values may be sent in one
    GET; POST the column as JSON or CSV to send more.
    A value shaped like an area code is `valid` when the release holds it. Otherwise it is `superseded`
    or `not-yet-current` when only older or newer releases of the geography hold it, `absent-from-
    release` when releases on both sides do, `other-geography` when only another geography holds it,
    `unknown` when nothing does, and `malformed-code` when it is a letter followed by other than eight
    digits.
    Any other value is a name. It is `matched` only exactly, through a published alias, or with an
    administrative title such as "City of" set aside, never by prefix or similarity. A name meaning
    several areas is `ambiguous` and lists them all; an `unmatched` name lists the other releases of the
    geography where it does match.
    Repeat `parent` alongside `value` to settle a shared name with a parent code or name. It resolves
    only when exactly one candidate has a published containment relationship to that parent. Each result
    says in `normalised` whether the value was trimmed or re-cased to be read, and in `duplicateOf`
    whether it repeats an earlier value. `summary.joinable` is true only when every value names exactly
    one area of the release.
    Every JSON result carries a versioned matching manifest with the Atlas release, exact submitted
    values and their digest, candidate decision and published-path recommendations. Use `format=csv` to
    download the same row-preserving result for a local join or audit.

    Args:
        geography (str | Unset):
        release (str | Unset):
        value (list[str]):
        parent (list[str] | Unset):
        format_ (ValidateAreaValuesFormat | Unset):  Default: ValidateAreaValuesFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return sync_detailed(
        client=client,
        geography=geography,
        release=release,
        value=value,
        parent=parent,
        format_=format_,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    value: list[str],
    parent: list[str] | Unset = UNSET,
    format_: ValidateAreaValuesFormat | Unset = ValidateAreaValuesFormat.JSON,
) -> Response[Envelope | Problem]:
    """Validate a batch of area codes or names, or infer their likely release

     With `geography` and `release`, checks each `value` against one exact boundary release before a
    caller joins data to it. Omit both to rank compiled geography/releases by exact resolutions and
    report the likely one; this is a diagnosis, never an automatic join or conversion. Where other
    releases resolve exactly as many values, the likely one is the newest of them and `likely.tiedWith`
    names the rest, since the values alone cannot tell them apart. At most 500 values may be sent in one
    GET; POST the column as JSON or CSV to send more.
    A value shaped like an area code is `valid` when the release holds it. Otherwise it is `superseded`
    or `not-yet-current` when only older or newer releases of the geography hold it, `absent-from-
    release` when releases on both sides do, `other-geography` when only another geography holds it,
    `unknown` when nothing does, and `malformed-code` when it is a letter followed by other than eight
    digits.
    Any other value is a name. It is `matched` only exactly, through a published alias, or with an
    administrative title such as "City of" set aside, never by prefix or similarity. A name meaning
    several areas is `ambiguous` and lists them all; an `unmatched` name lists the other releases of the
    geography where it does match.
    Repeat `parent` alongside `value` to settle a shared name with a parent code or name. It resolves
    only when exactly one candidate has a published containment relationship to that parent. Each result
    says in `normalised` whether the value was trimmed or re-cased to be read, and in `duplicateOf`
    whether it repeats an earlier value. `summary.joinable` is true only when every value names exactly
    one area of the release.
    Every JSON result carries a versioned matching manifest with the Atlas release, exact submitted
    values and their digest, candidate decision and published-path recommendations. Use `format=csv` to
    download the same row-preserving result for a local join or audit.

    Args:
        geography (str | Unset):
        release (str | Unset):
        value (list[str]):
        parent (list[str] | Unset):
        format_ (ValidateAreaValuesFormat | Unset):  Default: ValidateAreaValuesFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Envelope | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        release=release,
        value=value,
        parent=parent,
        format_=format_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    value: list[str],
    parent: list[str] | Unset = UNSET,
    format_: ValidateAreaValuesFormat | Unset = ValidateAreaValuesFormat.JSON,
) -> Envelope | Problem | None:
    """Validate a batch of area codes or names, or infer their likely release

     With `geography` and `release`, checks each `value` against one exact boundary release before a
    caller joins data to it. Omit both to rank compiled geography/releases by exact resolutions and
    report the likely one; this is a diagnosis, never an automatic join or conversion. Where other
    releases resolve exactly as many values, the likely one is the newest of them and `likely.tiedWith`
    names the rest, since the values alone cannot tell them apart. At most 500 values may be sent in one
    GET; POST the column as JSON or CSV to send more.
    A value shaped like an area code is `valid` when the release holds it. Otherwise it is `superseded`
    or `not-yet-current` when only older or newer releases of the geography hold it, `absent-from-
    release` when releases on both sides do, `other-geography` when only another geography holds it,
    `unknown` when nothing does, and `malformed-code` when it is a letter followed by other than eight
    digits.
    Any other value is a name. It is `matched` only exactly, through a published alias, or with an
    administrative title such as "City of" set aside, never by prefix or similarity. A name meaning
    several areas is `ambiguous` and lists them all; an `unmatched` name lists the other releases of the
    geography where it does match.
    Repeat `parent` alongside `value` to settle a shared name with a parent code or name. It resolves
    only when exactly one candidate has a published containment relationship to that parent. Each result
    says in `normalised` whether the value was trimmed or re-cased to be read, and in `duplicateOf`
    whether it repeats an earlier value. `summary.joinable` is true only when every value names exactly
    one area of the release.
    Every JSON result carries a versioned matching manifest with the Atlas release, exact submitted
    values and their digest, candidate decision and published-path recommendations. Use `format=csv` to
    download the same row-preserving result for a local join or audit.

    Args:
        geography (str | Unset):
        release (str | Unset):
        value (list[str]):
        parent (list[str] | Unset):
        format_ (ValidateAreaValuesFormat | Unset):  Default: ValidateAreaValuesFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Envelope | Problem
    """

    return (
        await asyncio_detailed(
            client=client,
            geography=geography,
            release=release,
            value=value,
            parent=parent,
            format_=format_,
        )
    ).parsed
