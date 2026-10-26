from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.conversion_not_available_problem import ConversionNotAvailableProblem
from ...models.convert_supplied_counts_json_body import ConvertSuppliedCountsJsonBody
from ...models.convert_supplied_counts_semantics import ConvertSuppliedCountsSemantics
from ...models.convert_supplied_counts_weighting import ConvertSuppliedCountsWeighting
from ...models.problem import Problem
from ...models.supplied_count_conversion_envelope import SuppliedCountConversionEnvelope
from ...types import UNSET, Response, Unset


def _get_kwargs(
    crosswalk_id: str,
    *,
    body: ConvertSuppliedCountsJsonBody,
    semantics: ConvertSuppliedCountsSemantics,
    weighting: ConvertSuppliedCountsWeighting | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    json_semantics = semantics.value
    params["semantics"] = json_semantics

    json_weighting: str | Unset = UNSET
    if not isinstance(weighting, Unset):
        json_weighting = weighting.value

    params["weighting"] = json_weighting

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/crosswalks/{crosswalk_id}:convert".format(
            crosswalk_id=quote(str(crosswalk_id), safe=""),
        ),
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> (
    Any
    | ConversionNotAvailableProblem
    | Problem
    | SuppliedCountConversionEnvelope
    | None
):
    if response.status_code == 200:
        response_200 = SuppliedCountConversionEnvelope.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 405:
        response_405 = cast(Any, None)
        return response_405

    if response.status_code == 413:
        response_413 = cast(Any, None)
        return response_413

    if response.status_code == 415:
        response_415 = cast(Any, None)
        return response_415

    if response.status_code == 422:
        response_422 = ConversionNotAvailableProblem.from_dict(response.json())

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
) -> Response[
    Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope
]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ConvertSuppliedCountsJsonBody,
    semantics: ConvertSuppliedCountsSemantics,
    weighting: ConvertSuppliedCountsWeighting | Unset = UNSET,
) -> Response[
    Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope
]:
    """Convert your own counts through a named crosswalk

     Send JSON rows or CSV with a code, area or name column and a numeric value column. An optional
    parent column disambiguates names. At most 250,000 rows in an 8 MiB body. Nothing is stored or
    cached.
    The crosswalk fixes the exact source and target releases. Its source identities must be compiled.
    semantics=count asserts that the values are finite, non-negative counts that add over areas.
    Fractions are allowed. A missing, invalid, ambiguous, duplicate or non-numeric row refuses the
    entire request with 422. Code and name rows resolving to the same area are duplicates. The first
    1,000 rejected rows are listed, with rejectedCount giving their full count.
    Omit weighting for exact regrouping. Splits require weighting=area or weighting=population matching
    the published crosswalk. An unweighted split or unmapped source refuses the entire request. Best-fit
    mappings cannot convert counts. Weighted results are estimates, with no rounding.
    Each output states whether every source this crosswalk maps to it was supplied. Complete coverage is
    relative to published crosswalk mappings, not the whole geography. Unreached targets are absent,
    never zero. The response pins the Atlas release, input text hash and crosswalk hash, and reports
    input and output totals. Send a UTF-8 body to reproduce its hash.

    Args:
        crosswalk_id (str):
        semantics (ConvertSuppliedCountsSemantics):
        weighting (ConvertSuppliedCountsWeighting | Unset):
        body (ConvertSuppliedCountsJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope]
    """

    kwargs = _get_kwargs(
        crosswalk_id=crosswalk_id,
        body=body,
        semantics=semantics,
        weighting=weighting,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ConvertSuppliedCountsJsonBody,
    semantics: ConvertSuppliedCountsSemantics,
    weighting: ConvertSuppliedCountsWeighting | Unset = UNSET,
) -> (
    Any
    | ConversionNotAvailableProblem
    | Problem
    | SuppliedCountConversionEnvelope
    | None
):
    """Convert your own counts through a named crosswalk

     Send JSON rows or CSV with a code, area or name column and a numeric value column. An optional
    parent column disambiguates names. At most 250,000 rows in an 8 MiB body. Nothing is stored or
    cached.
    The crosswalk fixes the exact source and target releases. Its source identities must be compiled.
    semantics=count asserts that the values are finite, non-negative counts that add over areas.
    Fractions are allowed. A missing, invalid, ambiguous, duplicate or non-numeric row refuses the
    entire request with 422. Code and name rows resolving to the same area are duplicates. The first
    1,000 rejected rows are listed, with rejectedCount giving their full count.
    Omit weighting for exact regrouping. Splits require weighting=area or weighting=population matching
    the published crosswalk. An unweighted split or unmapped source refuses the entire request. Best-fit
    mappings cannot convert counts. Weighted results are estimates, with no rounding.
    Each output states whether every source this crosswalk maps to it was supplied. Complete coverage is
    relative to published crosswalk mappings, not the whole geography. Unreached targets are absent,
    never zero. The response pins the Atlas release, input text hash and crosswalk hash, and reports
    input and output totals. Send a UTF-8 body to reproduce its hash.

    Args:
        crosswalk_id (str):
        semantics (ConvertSuppliedCountsSemantics):
        weighting (ConvertSuppliedCountsWeighting | Unset):
        body (ConvertSuppliedCountsJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope
    """

    return sync_detailed(
        crosswalk_id=crosswalk_id,
        client=client,
        body=body,
        semantics=semantics,
        weighting=weighting,
    ).parsed


async def asyncio_detailed(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ConvertSuppliedCountsJsonBody,
    semantics: ConvertSuppliedCountsSemantics,
    weighting: ConvertSuppliedCountsWeighting | Unset = UNSET,
) -> Response[
    Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope
]:
    """Convert your own counts through a named crosswalk

     Send JSON rows or CSV with a code, area or name column and a numeric value column. An optional
    parent column disambiguates names. At most 250,000 rows in an 8 MiB body. Nothing is stored or
    cached.
    The crosswalk fixes the exact source and target releases. Its source identities must be compiled.
    semantics=count asserts that the values are finite, non-negative counts that add over areas.
    Fractions are allowed. A missing, invalid, ambiguous, duplicate or non-numeric row refuses the
    entire request with 422. Code and name rows resolving to the same area are duplicates. The first
    1,000 rejected rows are listed, with rejectedCount giving their full count.
    Omit weighting for exact regrouping. Splits require weighting=area or weighting=population matching
    the published crosswalk. An unweighted split or unmapped source refuses the entire request. Best-fit
    mappings cannot convert counts. Weighted results are estimates, with no rounding.
    Each output states whether every source this crosswalk maps to it was supplied. Complete coverage is
    relative to published crosswalk mappings, not the whole geography. Unreached targets are absent,
    never zero. The response pins the Atlas release, input text hash and crosswalk hash, and reports
    input and output totals. Send a UTF-8 body to reproduce its hash.

    Args:
        crosswalk_id (str):
        semantics (ConvertSuppliedCountsSemantics):
        weighting (ConvertSuppliedCountsWeighting | Unset):
        body (ConvertSuppliedCountsJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope]
    """

    kwargs = _get_kwargs(
        crosswalk_id=crosswalk_id,
        body=body,
        semantics=semantics,
        weighting=weighting,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    crosswalk_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ConvertSuppliedCountsJsonBody,
    semantics: ConvertSuppliedCountsSemantics,
    weighting: ConvertSuppliedCountsWeighting | Unset = UNSET,
) -> (
    Any
    | ConversionNotAvailableProblem
    | Problem
    | SuppliedCountConversionEnvelope
    | None
):
    """Convert your own counts through a named crosswalk

     Send JSON rows or CSV with a code, area or name column and a numeric value column. An optional
    parent column disambiguates names. At most 250,000 rows in an 8 MiB body. Nothing is stored or
    cached.
    The crosswalk fixes the exact source and target releases. Its source identities must be compiled.
    semantics=count asserts that the values are finite, non-negative counts that add over areas.
    Fractions are allowed. A missing, invalid, ambiguous, duplicate or non-numeric row refuses the
    entire request with 422. Code and name rows resolving to the same area are duplicates. The first
    1,000 rejected rows are listed, with rejectedCount giving their full count.
    Omit weighting for exact regrouping. Splits require weighting=area or weighting=population matching
    the published crosswalk. An unweighted split or unmapped source refuses the entire request. Best-fit
    mappings cannot convert counts. Weighted results are estimates, with no rounding.
    Each output states whether every source this crosswalk maps to it was supplied. Complete coverage is
    relative to published crosswalk mappings, not the whole geography. Unreached targets are absent,
    never zero. The response pins the Atlas release, input text hash and crosswalk hash, and reports
    input and output totals. Send a UTF-8 body to reproduce its hash.

    Args:
        crosswalk_id (str):
        semantics (ConvertSuppliedCountsSemantics):
        weighting (ConvertSuppliedCountsWeighting | Unset):
        body (ConvertSuppliedCountsJsonBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | ConversionNotAvailableProblem | Problem | SuppliedCountConversionEnvelope
    """

    return (
        await asyncio_detailed(
            crosswalk_id=crosswalk_id,
            client=client,
            body=body,
            semantics=semantics,
            weighting=weighting,
        )
    ).parsed
