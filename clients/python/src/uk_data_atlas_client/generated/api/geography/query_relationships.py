from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.problem import Problem
from ...models.query_relationships_operation import QueryRelationshipsOperation
from ...models.query_relationships_purpose import QueryRelationshipsPurpose
from ...models.query_relationships_relation import QueryRelationshipsRelation
from ...models.query_relationships_response_200 import QueryRelationshipsResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    purpose: QueryRelationshipsPurpose | Unset = QueryRelationshipsPurpose.MEMBERSHIP,
    operation: QueryRelationshipsOperation | Unset = UNSET,
    measure: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    relation: QueryRelationshipsRelation | Unset = UNSET,
    limit: int | Unset = 25,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["from"] = from_

    params["to"] = to

    json_purpose: str | Unset = UNSET
    if not isinstance(purpose, Unset):
        json_purpose = purpose.value

    params["purpose"] = json_purpose

    json_operation: str | Unset = UNSET
    if not isinstance(operation, Unset):
        json_operation = operation.value

    params["operation"] = json_operation

    params["measure"] = measure

    params["geography"] = geography

    params["release"] = release

    json_relation: str | Unset = UNSET
    if not isinstance(relation, Unset):
        json_relation = relation.value

    params["relation"] = json_relation

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/relationships",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Problem | QueryRelationshipsResponse200 | None:
    if response.status_code == 200:
        response_200 = QueryRelationshipsResponse200.from_dict(response.json())

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
) -> Response[Problem | QueryRelationshipsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    purpose: QueryRelationshipsPurpose | Unset = QueryRelationshipsPurpose.MEMBERSHIP,
    operation: QueryRelationshipsOperation | Unset = UNSET,
    measure: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    relation: QueryRelationshipsRelation | Unset = UNSET,
    limit: int | Unset = 25,
) -> Response[Problem | QueryRelationshipsResponse200]:
    """Discover, assess and plan published geography relationships

     The front door for relationship evidence in the boundary archive. Supply
    `from={geography}/{release}` to discover every published conversion from one exact release. Add
    `to={geography}/{release}` to assess the paths for a `purpose`, their coverage, trust and permitted
    operations. Add `operation` to select the best published path for that intended operation, without
    translating any codes or values.

    Alternatively, supply `geography` and `release` to report how fully a release is covered by its
    published relationships. `relation` limits that report to one relationship kind. These two query
    shapes are deliberately separate: conversion is directional between exact releases, whereas coverage
    is an audit of one release's evidence.

    Args:
        from_ (str | Unset):
        to (str | Unset):
        purpose (QueryRelationshipsPurpose | Unset):  Default:
            QueryRelationshipsPurpose.MEMBERSHIP.
        operation (QueryRelationshipsOperation | Unset):
        measure (str | Unset):
        geography (str | Unset):
        release (str | Unset):
        relation (QueryRelationshipsRelation | Unset):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | QueryRelationshipsResponse200]
    """

    kwargs = _get_kwargs(
        from_=from_,
        to=to,
        purpose=purpose,
        operation=operation,
        measure=measure,
        geography=geography,
        release=release,
        relation=relation,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    purpose: QueryRelationshipsPurpose | Unset = QueryRelationshipsPurpose.MEMBERSHIP,
    operation: QueryRelationshipsOperation | Unset = UNSET,
    measure: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    relation: QueryRelationshipsRelation | Unset = UNSET,
    limit: int | Unset = 25,
) -> Problem | QueryRelationshipsResponse200 | None:
    """Discover, assess and plan published geography relationships

     The front door for relationship evidence in the boundary archive. Supply
    `from={geography}/{release}` to discover every published conversion from one exact release. Add
    `to={geography}/{release}` to assess the paths for a `purpose`, their coverage, trust and permitted
    operations. Add `operation` to select the best published path for that intended operation, without
    translating any codes or values.

    Alternatively, supply `geography` and `release` to report how fully a release is covered by its
    published relationships. `relation` limits that report to one relationship kind. These two query
    shapes are deliberately separate: conversion is directional between exact releases, whereas coverage
    is an audit of one release's evidence.

    Args:
        from_ (str | Unset):
        to (str | Unset):
        purpose (QueryRelationshipsPurpose | Unset):  Default:
            QueryRelationshipsPurpose.MEMBERSHIP.
        operation (QueryRelationshipsOperation | Unset):
        measure (str | Unset):
        geography (str | Unset):
        release (str | Unset):
        relation (QueryRelationshipsRelation | Unset):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | QueryRelationshipsResponse200
    """

    return sync_detailed(
        client=client,
        from_=from_,
        to=to,
        purpose=purpose,
        operation=operation,
        measure=measure,
        geography=geography,
        release=release,
        relation=relation,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    purpose: QueryRelationshipsPurpose | Unset = QueryRelationshipsPurpose.MEMBERSHIP,
    operation: QueryRelationshipsOperation | Unset = UNSET,
    measure: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    relation: QueryRelationshipsRelation | Unset = UNSET,
    limit: int | Unset = 25,
) -> Response[Problem | QueryRelationshipsResponse200]:
    """Discover, assess and plan published geography relationships

     The front door for relationship evidence in the boundary archive. Supply
    `from={geography}/{release}` to discover every published conversion from one exact release. Add
    `to={geography}/{release}` to assess the paths for a `purpose`, their coverage, trust and permitted
    operations. Add `operation` to select the best published path for that intended operation, without
    translating any codes or values.

    Alternatively, supply `geography` and `release` to report how fully a release is covered by its
    published relationships. `relation` limits that report to one relationship kind. These two query
    shapes are deliberately separate: conversion is directional between exact releases, whereas coverage
    is an audit of one release's evidence.

    Args:
        from_ (str | Unset):
        to (str | Unset):
        purpose (QueryRelationshipsPurpose | Unset):  Default:
            QueryRelationshipsPurpose.MEMBERSHIP.
        operation (QueryRelationshipsOperation | Unset):
        measure (str | Unset):
        geography (str | Unset):
        release (str | Unset):
        relation (QueryRelationshipsRelation | Unset):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | QueryRelationshipsResponse200]
    """

    kwargs = _get_kwargs(
        from_=from_,
        to=to,
        purpose=purpose,
        operation=operation,
        measure=measure,
        geography=geography,
        release=release,
        relation=relation,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    purpose: QueryRelationshipsPurpose | Unset = QueryRelationshipsPurpose.MEMBERSHIP,
    operation: QueryRelationshipsOperation | Unset = UNSET,
    measure: str | Unset = UNSET,
    geography: str | Unset = UNSET,
    release: str | Unset = UNSET,
    relation: QueryRelationshipsRelation | Unset = UNSET,
    limit: int | Unset = 25,
) -> Problem | QueryRelationshipsResponse200 | None:
    """Discover, assess and plan published geography relationships

     The front door for relationship evidence in the boundary archive. Supply
    `from={geography}/{release}` to discover every published conversion from one exact release. Add
    `to={geography}/{release}` to assess the paths for a `purpose`, their coverage, trust and permitted
    operations. Add `operation` to select the best published path for that intended operation, without
    translating any codes or values.

    Alternatively, supply `geography` and `release` to report how fully a release is covered by its
    published relationships. `relation` limits that report to one relationship kind. These two query
    shapes are deliberately separate: conversion is directional between exact releases, whereas coverage
    is an audit of one release's evidence.

    Args:
        from_ (str | Unset):
        to (str | Unset):
        purpose (QueryRelationshipsPurpose | Unset):  Default:
            QueryRelationshipsPurpose.MEMBERSHIP.
        operation (QueryRelationshipsOperation | Unset):
        measure (str | Unset):
        geography (str | Unset):
        release (str | Unset):
        relation (QueryRelationshipsRelation | Unset):
        limit (int | Unset):  Default: 25.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | QueryRelationshipsResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            from_=from_,
            to=to,
            purpose=purpose,
            operation=operation,
            measure=measure,
            geography=geography,
            release=release,
            relation=relation,
            limit=limit,
        )
    ).parsed
