from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.find_similar_areas_method import FindSimilarAreasMethod
from ...models.find_similar_areas_response_200 import FindSimilarAreasResponse200
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    geography: str,
    code: str,
    *,
    measures: str,
    period: str,
    limit: int | Unset = 10,
    method: FindSimilarAreasMethod | Unset = FindSimilarAreasMethod.ZSCORE_EUCLIDEAN,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["measures"] = measures

    params["period"] = period

    params["limit"] = limit

    json_method: str | Unset = UNSET
    if not isinstance(method, Unset):
        json_method = method.value

    params["method"] = json_method

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/areas/{geography}/{code}/similar".format(
            geography=quote(str(geography), safe=""),
            code=quote(str(code), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> FindSimilarAreasResponse200 | Problem | None:
    if response.status_code == 200:
        response_200 = FindSimilarAreasResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 400:
        response_400 = Problem.from_dict(response.json())

        return response_400

    if response.status_code == 404:
        response_404 = Problem.from_dict(response.json())

        return response_404

    if response.status_code == 422:
        response_422 = Problem.from_dict(response.json())

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
) -> Response[FindSimilarAreasResponse200 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    geography: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    measures: str,
    period: str,
    limit: int | Unset = 10,
    method: FindSimilarAreasMethod | Unset = FindSimilarAreasMethod.ZSCORE_EUCLIDEAN,
) -> Response[FindSimilarAreasResponse200 | Problem]:
    """Find areas most similar across selected measures

     Loads each selected measure's source-exact partition for the requested geography and period. All
    partitions must use the same boundary year. `zscore-euclidean` standardises every measure by its
    all-area mean and population standard deviation before calculating Euclidean distance. `rank-
    euclidean` uses average ranks, which is less sensitive to skewed values. Areas missing any selected
    value are excluded. The dropped count covers areas present in at least one selected partition.

    Args:
        geography (str):
        code (str):
        measures (str):
        period (str):
        limit (int | Unset):  Default: 10.
        method (FindSimilarAreasMethod | Unset):  Default:
            FindSimilarAreasMethod.ZSCORE_EUCLIDEAN.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[FindSimilarAreasResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        code=code,
        measures=measures,
        period=period,
        limit=limit,
        method=method,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    geography: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    measures: str,
    period: str,
    limit: int | Unset = 10,
    method: FindSimilarAreasMethod | Unset = FindSimilarAreasMethod.ZSCORE_EUCLIDEAN,
) -> FindSimilarAreasResponse200 | Problem | None:
    """Find areas most similar across selected measures

     Loads each selected measure's source-exact partition for the requested geography and period. All
    partitions must use the same boundary year. `zscore-euclidean` standardises every measure by its
    all-area mean and population standard deviation before calculating Euclidean distance. `rank-
    euclidean` uses average ranks, which is less sensitive to skewed values. Areas missing any selected
    value are excluded. The dropped count covers areas present in at least one selected partition.

    Args:
        geography (str):
        code (str):
        measures (str):
        period (str):
        limit (int | Unset):  Default: 10.
        method (FindSimilarAreasMethod | Unset):  Default:
            FindSimilarAreasMethod.ZSCORE_EUCLIDEAN.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        FindSimilarAreasResponse200 | Problem
    """

    return sync_detailed(
        geography=geography,
        code=code,
        client=client,
        measures=measures,
        period=period,
        limit=limit,
        method=method,
    ).parsed


async def asyncio_detailed(
    geography: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    measures: str,
    period: str,
    limit: int | Unset = 10,
    method: FindSimilarAreasMethod | Unset = FindSimilarAreasMethod.ZSCORE_EUCLIDEAN,
) -> Response[FindSimilarAreasResponse200 | Problem]:
    """Find areas most similar across selected measures

     Loads each selected measure's source-exact partition for the requested geography and period. All
    partitions must use the same boundary year. `zscore-euclidean` standardises every measure by its
    all-area mean and population standard deviation before calculating Euclidean distance. `rank-
    euclidean` uses average ranks, which is less sensitive to skewed values. Areas missing any selected
    value are excluded. The dropped count covers areas present in at least one selected partition.

    Args:
        geography (str):
        code (str):
        measures (str):
        period (str):
        limit (int | Unset):  Default: 10.
        method (FindSimilarAreasMethod | Unset):  Default:
            FindSimilarAreasMethod.ZSCORE_EUCLIDEAN.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[FindSimilarAreasResponse200 | Problem]
    """

    kwargs = _get_kwargs(
        geography=geography,
        code=code,
        measures=measures,
        period=period,
        limit=limit,
        method=method,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    geography: str,
    code: str,
    *,
    client: AuthenticatedClient | Client,
    measures: str,
    period: str,
    limit: int | Unset = 10,
    method: FindSimilarAreasMethod | Unset = FindSimilarAreasMethod.ZSCORE_EUCLIDEAN,
) -> FindSimilarAreasResponse200 | Problem | None:
    """Find areas most similar across selected measures

     Loads each selected measure's source-exact partition for the requested geography and period. All
    partitions must use the same boundary year. `zscore-euclidean` standardises every measure by its
    all-area mean and population standard deviation before calculating Euclidean distance. `rank-
    euclidean` uses average ranks, which is less sensitive to skewed values. Areas missing any selected
    value are excluded. The dropped count covers areas present in at least one selected partition.

    Args:
        geography (str):
        code (str):
        measures (str):
        period (str):
        limit (int | Unset):  Default: 10.
        method (FindSimilarAreasMethod | Unset):  Default:
            FindSimilarAreasMethod.ZSCORE_EUCLIDEAN.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        FindSimilarAreasResponse200 | Problem
    """

    return (
        await asyncio_detailed(
            geography=geography,
            code=code,
            client=client,
            measures=measures,
            period=period,
            limit=limit,
            method=method,
        )
    ).parsed
