from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...models.translate_area_code_purpose import TranslateAreaCodePurpose
from ...models.translate_area_code_response_200 import TranslateAreaCodeResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    from_: str,
    code: str,
    to: str,
    purpose: TranslateAreaCodePurpose | Unset = TranslateAreaCodePurpose.MEMBERSHIP,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["from"] = from_

    params["code"] = code

    params["to"] = to

    json_purpose: str | Unset = UNSET
    if not isinstance(purpose, Unset):
        json_purpose = purpose.value

    params["purpose"] = json_purpose

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/translations",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Problem | TranslateAreaCodeResponse200 | None:
    if response.status_code == 200:
        response_200 = TranslateAreaCodeResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 422:
        response_422 = Problem.from_dict(response.json())

        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Problem | TranslateAreaCodeResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    from_: str,
    code: str,
    to: str,
    purpose: TranslateAreaCodePurpose | Unset = TranslateAreaCodePurpose.MEMBERSHIP,
) -> Response[Problem | TranslateAreaCodeResponse200]:
    """Translate one code through a published conversion path in either direction

     `identity` permits publisher-supplied historical lookups only, `membership` permits clean
    containment only, and `apportion` permits area-overlap crosswalks only. The resolver selects every
    published path with that purpose, ranking direct paths before reviewed and then discovered
    compositions. `paths` records every step used. A direct result retains its directional crosswalk and
    provenance; a composed result carries its full `path` instead, so it cannot be mistaken for a direct
    lookup. A composed result's targets carry only their code, labels and, for `apportion`, the weight
    multiplied along the path: a step's shares, overlap area and population describe the areas that step
    joins, not the queried one. Reverse area-overlap weights are normalised against the queried target
    and report its source coverage. A composed apportion result retains that first-step `sourceCoverage`
    and reports `resolvedCoverage`, the share of the queried source its final targets represent. The
    route does not treat a shared code across releases as proof of unchanged geography.

    Args:
        from_ (str):
        code (str):
        to (str):
        purpose (TranslateAreaCodePurpose | Unset):  Default: TranslateAreaCodePurpose.MEMBERSHIP.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | TranslateAreaCodeResponse200]
    """

    kwargs = _get_kwargs(
        from_=from_,
        code=code,
        to=to,
        purpose=purpose,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    from_: str,
    code: str,
    to: str,
    purpose: TranslateAreaCodePurpose | Unset = TranslateAreaCodePurpose.MEMBERSHIP,
) -> Problem | TranslateAreaCodeResponse200 | None:
    """Translate one code through a published conversion path in either direction

     `identity` permits publisher-supplied historical lookups only, `membership` permits clean
    containment only, and `apportion` permits area-overlap crosswalks only. The resolver selects every
    published path with that purpose, ranking direct paths before reviewed and then discovered
    compositions. `paths` records every step used. A direct result retains its directional crosswalk and
    provenance; a composed result carries its full `path` instead, so it cannot be mistaken for a direct
    lookup. A composed result's targets carry only their code, labels and, for `apportion`, the weight
    multiplied along the path: a step's shares, overlap area and population describe the areas that step
    joins, not the queried one. Reverse area-overlap weights are normalised against the queried target
    and report its source coverage. A composed apportion result retains that first-step `sourceCoverage`
    and reports `resolvedCoverage`, the share of the queried source its final targets represent. The
    route does not treat a shared code across releases as proof of unchanged geography.

    Args:
        from_ (str):
        code (str):
        to (str):
        purpose (TranslateAreaCodePurpose | Unset):  Default: TranslateAreaCodePurpose.MEMBERSHIP.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | TranslateAreaCodeResponse200
    """

    return sync_detailed(
        client=client,
        from_=from_,
        code=code,
        to=to,
        purpose=purpose,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    from_: str,
    code: str,
    to: str,
    purpose: TranslateAreaCodePurpose | Unset = TranslateAreaCodePurpose.MEMBERSHIP,
) -> Response[Problem | TranslateAreaCodeResponse200]:
    """Translate one code through a published conversion path in either direction

     `identity` permits publisher-supplied historical lookups only, `membership` permits clean
    containment only, and `apportion` permits area-overlap crosswalks only. The resolver selects every
    published path with that purpose, ranking direct paths before reviewed and then discovered
    compositions. `paths` records every step used. A direct result retains its directional crosswalk and
    provenance; a composed result carries its full `path` instead, so it cannot be mistaken for a direct
    lookup. A composed result's targets carry only their code, labels and, for `apportion`, the weight
    multiplied along the path: a step's shares, overlap area and population describe the areas that step
    joins, not the queried one. Reverse area-overlap weights are normalised against the queried target
    and report its source coverage. A composed apportion result retains that first-step `sourceCoverage`
    and reports `resolvedCoverage`, the share of the queried source its final targets represent. The
    route does not treat a shared code across releases as proof of unchanged geography.

    Args:
        from_ (str):
        code (str):
        to (str):
        purpose (TranslateAreaCodePurpose | Unset):  Default: TranslateAreaCodePurpose.MEMBERSHIP.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | TranslateAreaCodeResponse200]
    """

    kwargs = _get_kwargs(
        from_=from_,
        code=code,
        to=to,
        purpose=purpose,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    from_: str,
    code: str,
    to: str,
    purpose: TranslateAreaCodePurpose | Unset = TranslateAreaCodePurpose.MEMBERSHIP,
) -> Problem | TranslateAreaCodeResponse200 | None:
    """Translate one code through a published conversion path in either direction

     `identity` permits publisher-supplied historical lookups only, `membership` permits clean
    containment only, and `apportion` permits area-overlap crosswalks only. The resolver selects every
    published path with that purpose, ranking direct paths before reviewed and then discovered
    compositions. `paths` records every step used. A direct result retains its directional crosswalk and
    provenance; a composed result carries its full `path` instead, so it cannot be mistaken for a direct
    lookup. A composed result's targets carry only their code, labels and, for `apportion`, the weight
    multiplied along the path: a step's shares, overlap area and population describe the areas that step
    joins, not the queried one. Reverse area-overlap weights are normalised against the queried target
    and report its source coverage. A composed apportion result retains that first-step `sourceCoverage`
    and reports `resolvedCoverage`, the share of the queried source its final targets represent. The
    route does not treat a shared code across releases as proof of unchanged geography.

    Args:
        from_ (str):
        code (str):
        to (str):
        purpose (TranslateAreaCodePurpose | Unset):  Default: TranslateAreaCodePurpose.MEMBERSHIP.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | TranslateAreaCodeResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            from_=from_,
            code=code,
            to=to,
            purpose=purpose,
        )
    ).parsed
