from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.ambiguous_place_problem import AmbiguousPlaceProblem
from ...models.envelope import Envelope
from ...models.get_measure_observations_format import GetMeasureObservationsFormat
from ...models.get_measure_observations_geography import GetMeasureObservationsGeography
from ...models.get_measure_observations_include import GetMeasureObservationsInclude
from ...models.get_measure_observations_units import GetMeasureObservationsUnits
from ...models.problem import Problem
from ...types import UNSET, Response, Unset


def _get_kwargs(
    measure_id: str,
    *,
    period: str | Unset = UNSET,
    geography: GetMeasureObservationsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    release: str | Unset = UNSET,
    place: str | Unset = UNSET,
    include: GetMeasureObservationsInclude | Unset = UNSET,
    format_: GetMeasureObservationsFormat | Unset = GetMeasureObservationsFormat.JSON,
    units: GetMeasureObservationsUnits | Unset = GetMeasureObservationsUnits.SOURCE,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["period"] = period

    json_geography: str | Unset = UNSET
    if not isinstance(geography, Unset):
        json_geography = geography.value

    params["geography"] = json_geography

    params["codeYear"] = code_year

    params["release"] = release

    params["place"] = place

    json_include: str | Unset = UNSET
    if not isinstance(include, Unset):
        json_include = include.value

    params["include"] = json_include

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_

    json_units: str | Unset = UNSET
    if not isinstance(units, Unset):
        json_units = units.value

    params["units"] = json_units

    params["limit"] = limit

    params["cursor"] = cursor

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/data/{measure_id}".format(
            measure_id=quote(str(measure_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
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
        response_409 = AmbiguousPlaceProblem.from_dict(response.json())

        return response_409

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
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
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
    period: str | Unset = UNSET,
    geography: GetMeasureObservationsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    release: str | Unset = UNSET,
    place: str | Unset = UNSET,
    include: GetMeasureObservationsInclude | Unset = UNSET,
    format_: GetMeasureObservationsFormat | Unset = GetMeasureObservationsFormat.JSON,
    units: GetMeasureObservationsUnits | Unset = GetMeasureObservationsUnits.SOURCE,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Retrieve source-exact observations, or an opt-in canonical-unit representation

     Serves observed values for one published measure and source partition. `population` covers 2022 Ward
    2023 codes in England and Wales, 2011–2024 Local Authority 2023 codes across all four UK nations,
    and ONS's own mid-2021 and mid-2022 estimates for the July 2024 Westminster constituencies in
    England and Wales. `ghg-emissions` covers 2005–2024 Local Authority 2025 codes across all four
    nations, as net territorial emissions in kt CO2e; emissions per resident are not served, because a
    ratio cannot be summed over areas. `total-jobs` covers 2011–2024 Local Authority 2023 codes, as jobs
    counted at the workplace and rounded by ONS to the nearest thousand. Great Britain is published for
    every year and Northern Ireland for 2020 to 2022 only; in the other years Northern Ireland has no
    records rather than zero jobs, so a sum over it is refused, not reported as 0. `mobile-4g-coverage`
    and `mobile-5g-coverage` cover 2025 Local Authority 2024 codes across all four nations, as the share
    of premises reached by all four mobile network operators. Both are declared intensive: a share does
    not add over areas, and combining authorities needs the premises weight the measure names. `house-
    price-median` covers ward-level median price paid for England and Wales, 1995-2022, each period the
    year ending December, under the ward codes the publisher used except for one reviewed, code-only
    correction: Temple Newsam's E05013831 is served as the geometrically identical December 2020 code
    E05011412, with the publisher code carried as `sourceAreaCode`. It is declared `non-aggregatable`
    with `statistic: median`: a median of medians is not the median of the underlying sales, so
    aggregation and conversion both refuse it.
    `imd-rank` and `imd-decile` cover the English Index of Multiple Deprivation 2019 for 32,844 LSOAs on
    2011 codes. Both are ordinal and `non-aggregatable`, and both are positions within England alone:
    the other nations' indices use different methods and cannot be compared.
    `wimd-rank` and `wimd-decile` cover the Welsh Index of Multiple Deprivation 2019 for 1,909 LSOAs on
    2011 codes, as published.
    `simd-rank` and `simd-decile` cover the Scottish Index of Multiple Deprivation 2020v2 for 6,976 data
    zones on 2011 codes, as published.
    `nimdm-rank` covers the Northern Ireland Multiple Deprivation Measure 2017 for 890 super output
    areas, identified by NISRA codes such as `95AA01S1` rather than GSS codes.
    `life-expectancy-male` and `life-expectancy-female` cover life expectancy at birth in England, Wales
    and Northern Ireland for every three-year period from 2001 to 2003 to 2020 to 2022, on December 2021
    local-authority codes. They are `non-aggregatable`: a combined population's life expectancy has to
    be recalculated from deaths and population, not averaged.
    A measure that declares `uncertainty` carries the publisher's interval on each record as
    `confidenceInterval` (`lower`, `upper`), at the level the measure states. Intervals are never
    computed by this API.
    `population-density` is the one derived measure: mid-year population divided by ONS Standard Area
    Measurement land area, which excludes inland water. Its values carry `status: "derived"` rather than
    `observed`, no publisher is answerable for the quotient, and the measure names both input datasets
    in `derivedFrom` so attribution covers the denominator. It is intensive, so it neither aggregates
    nor converts.
    The `travel-to-work-*` and `car-availability-*` measures cover Census 2021 Local Authority April
    2023 codes for England and Wales, as counts rather than shares; the four authorities created in
    April 2023 are summed from their predecessors, which are not served, so no resident is counted
    twice: a count of people or households adds over areas, and each breakdown publishes its own
    `-total` denominator so a caller can derive a share and know what it is a share of.
    `qualification-*` covers the same authorities' usual residents aged 16 and over by highest
    qualification, with its own `-total`, and `ethnicity-*` their usual residents in each of the
    nineteen census ethnic groups, which are exhaustive and so need no separate total.
    `broadband-*-availability` covers July 2025 Local Authority 2024 codes across all four nations, as
    the share of premises able to receive each service; like mobile coverage it is weighted by premises
    and is not offered for aggregation. `claimant-count` and `claimant-count-16-to-24` cover April 2026
    Local Authority 2024 codes across all four nations, as counts of Universal Credit and Jobseeker's
    Allowance claimants rounded to the nearest five. `temporary-accommodation-households`, `-households-
    with-children` and `-children` cover January to March 2026 Local Authority 2025 codes for England;
    authorities that submitted no return have no record, so an England total over them is reported with
    partial coverage. `median-annual-pay` and `median-hourly-pay` cover 2025 provisional Local Authority
    2025 codes for England, as median gross pay of employee jobs by where the employee lives; a median
    is not aggregatable. The `crime-*` measures cover the year ending March 2026 on Community Safety
    Partnership 2023 codes for England and Wales, as offence counts excluding fraud; offences unassigned
    to a partnership are not included, so partnership sums fall short of force and national totals.
    `unemployment-rate` and `unemployment-level` are ONS's final model-based estimates for Great Britain
    with 95% confidence intervals, on Local Authority 2019 codes for every period from 1996-97 to 2021
    and on Local Authority 2021 codes for 2020 and 2021; periods to 2003-04 are financial years.
    `no2-background-mean`, `pm10-background-mean` and `pm25-background-mean` cover 2024 Local Authority
    2024 codes across all four nations, as area means of Defra's 1x1 km PCM background maps, derived by
    this Atlas and aggregated weighted by `air-quality-grid-cells`; `pm25-population-weighted` and its
    `-anthropogenic` part are Defra's published population-weighted concentrations. This route never
    selects a May/December boundary release, converts values between geographies, or aggregates them. By
    default, it serves publisher-reported values and any reviewed, documented code-only repairs. A
    caller may ask for `units=canonical` to multiply numeric values and any published interval bounds by
    the measure's declared canonical scale. That response identifies the calculation and canonical unit;
    it never changes an observation artifact. A caller may supply `release` only when the compatibility
    report proves that every source code is present; the response identifies that caller-selected code
    join. `GET /measures/{measure-id}` declares valid period/geography combinations, and `GET
    /documents/measure-{measure-id}.json` declares eligible releases. The geography may be left out when
    `place` names an area, by name or code, or the measure is published on one; the boundary year and
    period then default to the newest partition and its latest period, stated in `defaults`. Every
    response includes compact provenance linking the immutable Atlas release, measure, source dataset
    and observation artifact, along with the selected geography match and an explicit statement that no
    transformation has been applied.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetMeasureObservationsGeography | Unset):
        code_year (int | Unset):
        release (str | Unset):
        place (str | Unset):
        include (GetMeasureObservationsInclude | Unset):
        format_ (GetMeasureObservationsFormat | Unset):  Default:
            GetMeasureObservationsFormat.JSON.
        units (GetMeasureObservationsUnits | Unset):  Default: GetMeasureObservationsUnits.SOURCE.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        period=period,
        geography=geography,
        code_year=code_year,
        release=release,
        place=place,
        include=include,
        format_=format_,
        units=units,
        limit=limit,
        cursor=cursor,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetMeasureObservationsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    release: str | Unset = UNSET,
    place: str | Unset = UNSET,
    include: GetMeasureObservationsInclude | Unset = UNSET,
    format_: GetMeasureObservationsFormat | Unset = GetMeasureObservationsFormat.JSON,
    units: GetMeasureObservationsUnits | Unset = GetMeasureObservationsUnits.SOURCE,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Retrieve source-exact observations, or an opt-in canonical-unit representation

     Serves observed values for one published measure and source partition. `population` covers 2022 Ward
    2023 codes in England and Wales, 2011–2024 Local Authority 2023 codes across all four UK nations,
    and ONS's own mid-2021 and mid-2022 estimates for the July 2024 Westminster constituencies in
    England and Wales. `ghg-emissions` covers 2005–2024 Local Authority 2025 codes across all four
    nations, as net territorial emissions in kt CO2e; emissions per resident are not served, because a
    ratio cannot be summed over areas. `total-jobs` covers 2011–2024 Local Authority 2023 codes, as jobs
    counted at the workplace and rounded by ONS to the nearest thousand. Great Britain is published for
    every year and Northern Ireland for 2020 to 2022 only; in the other years Northern Ireland has no
    records rather than zero jobs, so a sum over it is refused, not reported as 0. `mobile-4g-coverage`
    and `mobile-5g-coverage` cover 2025 Local Authority 2024 codes across all four nations, as the share
    of premises reached by all four mobile network operators. Both are declared intensive: a share does
    not add over areas, and combining authorities needs the premises weight the measure names. `house-
    price-median` covers ward-level median price paid for England and Wales, 1995-2022, each period the
    year ending December, under the ward codes the publisher used except for one reviewed, code-only
    correction: Temple Newsam's E05013831 is served as the geometrically identical December 2020 code
    E05011412, with the publisher code carried as `sourceAreaCode`. It is declared `non-aggregatable`
    with `statistic: median`: a median of medians is not the median of the underlying sales, so
    aggregation and conversion both refuse it.
    `imd-rank` and `imd-decile` cover the English Index of Multiple Deprivation 2019 for 32,844 LSOAs on
    2011 codes. Both are ordinal and `non-aggregatable`, and both are positions within England alone:
    the other nations' indices use different methods and cannot be compared.
    `wimd-rank` and `wimd-decile` cover the Welsh Index of Multiple Deprivation 2019 for 1,909 LSOAs on
    2011 codes, as published.
    `simd-rank` and `simd-decile` cover the Scottish Index of Multiple Deprivation 2020v2 for 6,976 data
    zones on 2011 codes, as published.
    `nimdm-rank` covers the Northern Ireland Multiple Deprivation Measure 2017 for 890 super output
    areas, identified by NISRA codes such as `95AA01S1` rather than GSS codes.
    `life-expectancy-male` and `life-expectancy-female` cover life expectancy at birth in England, Wales
    and Northern Ireland for every three-year period from 2001 to 2003 to 2020 to 2022, on December 2021
    local-authority codes. They are `non-aggregatable`: a combined population's life expectancy has to
    be recalculated from deaths and population, not averaged.
    A measure that declares `uncertainty` carries the publisher's interval on each record as
    `confidenceInterval` (`lower`, `upper`), at the level the measure states. Intervals are never
    computed by this API.
    `population-density` is the one derived measure: mid-year population divided by ONS Standard Area
    Measurement land area, which excludes inland water. Its values carry `status: "derived"` rather than
    `observed`, no publisher is answerable for the quotient, and the measure names both input datasets
    in `derivedFrom` so attribution covers the denominator. It is intensive, so it neither aggregates
    nor converts.
    The `travel-to-work-*` and `car-availability-*` measures cover Census 2021 Local Authority April
    2023 codes for England and Wales, as counts rather than shares; the four authorities created in
    April 2023 are summed from their predecessors, which are not served, so no resident is counted
    twice: a count of people or households adds over areas, and each breakdown publishes its own
    `-total` denominator so a caller can derive a share and know what it is a share of.
    `qualification-*` covers the same authorities' usual residents aged 16 and over by highest
    qualification, with its own `-total`, and `ethnicity-*` their usual residents in each of the
    nineteen census ethnic groups, which are exhaustive and so need no separate total.
    `broadband-*-availability` covers July 2025 Local Authority 2024 codes across all four nations, as
    the share of premises able to receive each service; like mobile coverage it is weighted by premises
    and is not offered for aggregation. `claimant-count` and `claimant-count-16-to-24` cover April 2026
    Local Authority 2024 codes across all four nations, as counts of Universal Credit and Jobseeker's
    Allowance claimants rounded to the nearest five. `temporary-accommodation-households`, `-households-
    with-children` and `-children` cover January to March 2026 Local Authority 2025 codes for England;
    authorities that submitted no return have no record, so an England total over them is reported with
    partial coverage. `median-annual-pay` and `median-hourly-pay` cover 2025 provisional Local Authority
    2025 codes for England, as median gross pay of employee jobs by where the employee lives; a median
    is not aggregatable. The `crime-*` measures cover the year ending March 2026 on Community Safety
    Partnership 2023 codes for England and Wales, as offence counts excluding fraud; offences unassigned
    to a partnership are not included, so partnership sums fall short of force and national totals.
    `unemployment-rate` and `unemployment-level` are ONS's final model-based estimates for Great Britain
    with 95% confidence intervals, on Local Authority 2019 codes for every period from 1996-97 to 2021
    and on Local Authority 2021 codes for 2020 and 2021; periods to 2003-04 are financial years.
    `no2-background-mean`, `pm10-background-mean` and `pm25-background-mean` cover 2024 Local Authority
    2024 codes across all four nations, as area means of Defra's 1x1 km PCM background maps, derived by
    this Atlas and aggregated weighted by `air-quality-grid-cells`; `pm25-population-weighted` and its
    `-anthropogenic` part are Defra's published population-weighted concentrations. This route never
    selects a May/December boundary release, converts values between geographies, or aggregates them. By
    default, it serves publisher-reported values and any reviewed, documented code-only repairs. A
    caller may ask for `units=canonical` to multiply numeric values and any published interval bounds by
    the measure's declared canonical scale. That response identifies the calculation and canonical unit;
    it never changes an observation artifact. A caller may supply `release` only when the compatibility
    report proves that every source code is present; the response identifies that caller-selected code
    join. `GET /measures/{measure-id}` declares valid period/geography combinations, and `GET
    /documents/measure-{measure-id}.json` declares eligible releases. The geography may be left out when
    `place` names an area, by name or code, or the measure is published on one; the boundary year and
    period then default to the newest partition and its latest period, stated in `defaults`. Every
    response includes compact provenance linking the immutable Atlas release, measure, source dataset
    and observation artifact, along with the selected geography match and an explicit statement that no
    transformation has been applied.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetMeasureObservationsGeography | Unset):
        code_year (int | Unset):
        release (str | Unset):
        place (str | Unset):
        include (GetMeasureObservationsInclude | Unset):
        format_ (GetMeasureObservationsFormat | Unset):  Default:
            GetMeasureObservationsFormat.JSON.
        units (GetMeasureObservationsUnits | Unset):  Default: GetMeasureObservationsUnits.SOURCE.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AmbiguousPlaceProblem | Envelope | Problem
    """

    return sync_detailed(
        measure_id=measure_id,
        client=client,
        period=period,
        geography=geography,
        code_year=code_year,
        release=release,
        place=place,
        include=include,
        format_=format_,
        units=units,
        limit=limit,
        cursor=cursor,
    ).parsed


async def asyncio_detailed(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetMeasureObservationsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    release: str | Unset = UNSET,
    place: str | Unset = UNSET,
    include: GetMeasureObservationsInclude | Unset = UNSET,
    format_: GetMeasureObservationsFormat | Unset = GetMeasureObservationsFormat.JSON,
    units: GetMeasureObservationsUnits | Unset = GetMeasureObservationsUnits.SOURCE,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> Response[AmbiguousPlaceProblem | Envelope | Problem]:
    """Retrieve source-exact observations, or an opt-in canonical-unit representation

     Serves observed values for one published measure and source partition. `population` covers 2022 Ward
    2023 codes in England and Wales, 2011–2024 Local Authority 2023 codes across all four UK nations,
    and ONS's own mid-2021 and mid-2022 estimates for the July 2024 Westminster constituencies in
    England and Wales. `ghg-emissions` covers 2005–2024 Local Authority 2025 codes across all four
    nations, as net territorial emissions in kt CO2e; emissions per resident are not served, because a
    ratio cannot be summed over areas. `total-jobs` covers 2011–2024 Local Authority 2023 codes, as jobs
    counted at the workplace and rounded by ONS to the nearest thousand. Great Britain is published for
    every year and Northern Ireland for 2020 to 2022 only; in the other years Northern Ireland has no
    records rather than zero jobs, so a sum over it is refused, not reported as 0. `mobile-4g-coverage`
    and `mobile-5g-coverage` cover 2025 Local Authority 2024 codes across all four nations, as the share
    of premises reached by all four mobile network operators. Both are declared intensive: a share does
    not add over areas, and combining authorities needs the premises weight the measure names. `house-
    price-median` covers ward-level median price paid for England and Wales, 1995-2022, each period the
    year ending December, under the ward codes the publisher used except for one reviewed, code-only
    correction: Temple Newsam's E05013831 is served as the geometrically identical December 2020 code
    E05011412, with the publisher code carried as `sourceAreaCode`. It is declared `non-aggregatable`
    with `statistic: median`: a median of medians is not the median of the underlying sales, so
    aggregation and conversion both refuse it.
    `imd-rank` and `imd-decile` cover the English Index of Multiple Deprivation 2019 for 32,844 LSOAs on
    2011 codes. Both are ordinal and `non-aggregatable`, and both are positions within England alone:
    the other nations' indices use different methods and cannot be compared.
    `wimd-rank` and `wimd-decile` cover the Welsh Index of Multiple Deprivation 2019 for 1,909 LSOAs on
    2011 codes, as published.
    `simd-rank` and `simd-decile` cover the Scottish Index of Multiple Deprivation 2020v2 for 6,976 data
    zones on 2011 codes, as published.
    `nimdm-rank` covers the Northern Ireland Multiple Deprivation Measure 2017 for 890 super output
    areas, identified by NISRA codes such as `95AA01S1` rather than GSS codes.
    `life-expectancy-male` and `life-expectancy-female` cover life expectancy at birth in England, Wales
    and Northern Ireland for every three-year period from 2001 to 2003 to 2020 to 2022, on December 2021
    local-authority codes. They are `non-aggregatable`: a combined population's life expectancy has to
    be recalculated from deaths and population, not averaged.
    A measure that declares `uncertainty` carries the publisher's interval on each record as
    `confidenceInterval` (`lower`, `upper`), at the level the measure states. Intervals are never
    computed by this API.
    `population-density` is the one derived measure: mid-year population divided by ONS Standard Area
    Measurement land area, which excludes inland water. Its values carry `status: "derived"` rather than
    `observed`, no publisher is answerable for the quotient, and the measure names both input datasets
    in `derivedFrom` so attribution covers the denominator. It is intensive, so it neither aggregates
    nor converts.
    The `travel-to-work-*` and `car-availability-*` measures cover Census 2021 Local Authority April
    2023 codes for England and Wales, as counts rather than shares; the four authorities created in
    April 2023 are summed from their predecessors, which are not served, so no resident is counted
    twice: a count of people or households adds over areas, and each breakdown publishes its own
    `-total` denominator so a caller can derive a share and know what it is a share of.
    `qualification-*` covers the same authorities' usual residents aged 16 and over by highest
    qualification, with its own `-total`, and `ethnicity-*` their usual residents in each of the
    nineteen census ethnic groups, which are exhaustive and so need no separate total.
    `broadband-*-availability` covers July 2025 Local Authority 2024 codes across all four nations, as
    the share of premises able to receive each service; like mobile coverage it is weighted by premises
    and is not offered for aggregation. `claimant-count` and `claimant-count-16-to-24` cover April 2026
    Local Authority 2024 codes across all four nations, as counts of Universal Credit and Jobseeker's
    Allowance claimants rounded to the nearest five. `temporary-accommodation-households`, `-households-
    with-children` and `-children` cover January to March 2026 Local Authority 2025 codes for England;
    authorities that submitted no return have no record, so an England total over them is reported with
    partial coverage. `median-annual-pay` and `median-hourly-pay` cover 2025 provisional Local Authority
    2025 codes for England, as median gross pay of employee jobs by where the employee lives; a median
    is not aggregatable. The `crime-*` measures cover the year ending March 2026 on Community Safety
    Partnership 2023 codes for England and Wales, as offence counts excluding fraud; offences unassigned
    to a partnership are not included, so partnership sums fall short of force and national totals.
    `unemployment-rate` and `unemployment-level` are ONS's final model-based estimates for Great Britain
    with 95% confidence intervals, on Local Authority 2019 codes for every period from 1996-97 to 2021
    and on Local Authority 2021 codes for 2020 and 2021; periods to 2003-04 are financial years.
    `no2-background-mean`, `pm10-background-mean` and `pm25-background-mean` cover 2024 Local Authority
    2024 codes across all four nations, as area means of Defra's 1x1 km PCM background maps, derived by
    this Atlas and aggregated weighted by `air-quality-grid-cells`; `pm25-population-weighted` and its
    `-anthropogenic` part are Defra's published population-weighted concentrations. This route never
    selects a May/December boundary release, converts values between geographies, or aggregates them. By
    default, it serves publisher-reported values and any reviewed, documented code-only repairs. A
    caller may ask for `units=canonical` to multiply numeric values and any published interval bounds by
    the measure's declared canonical scale. That response identifies the calculation and canonical unit;
    it never changes an observation artifact. A caller may supply `release` only when the compatibility
    report proves that every source code is present; the response identifies that caller-selected code
    join. `GET /measures/{measure-id}` declares valid period/geography combinations, and `GET
    /documents/measure-{measure-id}.json` declares eligible releases. The geography may be left out when
    `place` names an area, by name or code, or the measure is published on one; the boundary year and
    period then default to the newest partition and its latest period, stated in `defaults`. Every
    response includes compact provenance linking the immutable Atlas release, measure, source dataset
    and observation artifact, along with the selected geography match and an explicit statement that no
    transformation has been applied.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetMeasureObservationsGeography | Unset):
        code_year (int | Unset):
        release (str | Unset):
        place (str | Unset):
        include (GetMeasureObservationsInclude | Unset):
        format_ (GetMeasureObservationsFormat | Unset):  Default:
            GetMeasureObservationsFormat.JSON.
        units (GetMeasureObservationsUnits | Unset):  Default: GetMeasureObservationsUnits.SOURCE.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AmbiguousPlaceProblem | Envelope | Problem]
    """

    kwargs = _get_kwargs(
        measure_id=measure_id,
        period=period,
        geography=geography,
        code_year=code_year,
        release=release,
        place=place,
        include=include,
        format_=format_,
        units=units,
        limit=limit,
        cursor=cursor,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    measure_id: str,
    *,
    client: AuthenticatedClient | Client,
    period: str | Unset = UNSET,
    geography: GetMeasureObservationsGeography | Unset = UNSET,
    code_year: int | Unset = UNSET,
    release: str | Unset = UNSET,
    place: str | Unset = UNSET,
    include: GetMeasureObservationsInclude | Unset = UNSET,
    format_: GetMeasureObservationsFormat | Unset = GetMeasureObservationsFormat.JSON,
    units: GetMeasureObservationsUnits | Unset = GetMeasureObservationsUnits.SOURCE,
    limit: int | Unset = 100,
    cursor: str | Unset = UNSET,
) -> AmbiguousPlaceProblem | Envelope | Problem | None:
    """Retrieve source-exact observations, or an opt-in canonical-unit representation

     Serves observed values for one published measure and source partition. `population` covers 2022 Ward
    2023 codes in England and Wales, 2011–2024 Local Authority 2023 codes across all four UK nations,
    and ONS's own mid-2021 and mid-2022 estimates for the July 2024 Westminster constituencies in
    England and Wales. `ghg-emissions` covers 2005–2024 Local Authority 2025 codes across all four
    nations, as net territorial emissions in kt CO2e; emissions per resident are not served, because a
    ratio cannot be summed over areas. `total-jobs` covers 2011–2024 Local Authority 2023 codes, as jobs
    counted at the workplace and rounded by ONS to the nearest thousand. Great Britain is published for
    every year and Northern Ireland for 2020 to 2022 only; in the other years Northern Ireland has no
    records rather than zero jobs, so a sum over it is refused, not reported as 0. `mobile-4g-coverage`
    and `mobile-5g-coverage` cover 2025 Local Authority 2024 codes across all four nations, as the share
    of premises reached by all four mobile network operators. Both are declared intensive: a share does
    not add over areas, and combining authorities needs the premises weight the measure names. `house-
    price-median` covers ward-level median price paid for England and Wales, 1995-2022, each period the
    year ending December, under the ward codes the publisher used except for one reviewed, code-only
    correction: Temple Newsam's E05013831 is served as the geometrically identical December 2020 code
    E05011412, with the publisher code carried as `sourceAreaCode`. It is declared `non-aggregatable`
    with `statistic: median`: a median of medians is not the median of the underlying sales, so
    aggregation and conversion both refuse it.
    `imd-rank` and `imd-decile` cover the English Index of Multiple Deprivation 2019 for 32,844 LSOAs on
    2011 codes. Both are ordinal and `non-aggregatable`, and both are positions within England alone:
    the other nations' indices use different methods and cannot be compared.
    `wimd-rank` and `wimd-decile` cover the Welsh Index of Multiple Deprivation 2019 for 1,909 LSOAs on
    2011 codes, as published.
    `simd-rank` and `simd-decile` cover the Scottish Index of Multiple Deprivation 2020v2 for 6,976 data
    zones on 2011 codes, as published.
    `nimdm-rank` covers the Northern Ireland Multiple Deprivation Measure 2017 for 890 super output
    areas, identified by NISRA codes such as `95AA01S1` rather than GSS codes.
    `life-expectancy-male` and `life-expectancy-female` cover life expectancy at birth in England, Wales
    and Northern Ireland for every three-year period from 2001 to 2003 to 2020 to 2022, on December 2021
    local-authority codes. They are `non-aggregatable`: a combined population's life expectancy has to
    be recalculated from deaths and population, not averaged.
    A measure that declares `uncertainty` carries the publisher's interval on each record as
    `confidenceInterval` (`lower`, `upper`), at the level the measure states. Intervals are never
    computed by this API.
    `population-density` is the one derived measure: mid-year population divided by ONS Standard Area
    Measurement land area, which excludes inland water. Its values carry `status: "derived"` rather than
    `observed`, no publisher is answerable for the quotient, and the measure names both input datasets
    in `derivedFrom` so attribution covers the denominator. It is intensive, so it neither aggregates
    nor converts.
    The `travel-to-work-*` and `car-availability-*` measures cover Census 2021 Local Authority April
    2023 codes for England and Wales, as counts rather than shares; the four authorities created in
    April 2023 are summed from their predecessors, which are not served, so no resident is counted
    twice: a count of people or households adds over areas, and each breakdown publishes its own
    `-total` denominator so a caller can derive a share and know what it is a share of.
    `qualification-*` covers the same authorities' usual residents aged 16 and over by highest
    qualification, with its own `-total`, and `ethnicity-*` their usual residents in each of the
    nineteen census ethnic groups, which are exhaustive and so need no separate total.
    `broadband-*-availability` covers July 2025 Local Authority 2024 codes across all four nations, as
    the share of premises able to receive each service; like mobile coverage it is weighted by premises
    and is not offered for aggregation. `claimant-count` and `claimant-count-16-to-24` cover April 2026
    Local Authority 2024 codes across all four nations, as counts of Universal Credit and Jobseeker's
    Allowance claimants rounded to the nearest five. `temporary-accommodation-households`, `-households-
    with-children` and `-children` cover January to March 2026 Local Authority 2025 codes for England;
    authorities that submitted no return have no record, so an England total over them is reported with
    partial coverage. `median-annual-pay` and `median-hourly-pay` cover 2025 provisional Local Authority
    2025 codes for England, as median gross pay of employee jobs by where the employee lives; a median
    is not aggregatable. The `crime-*` measures cover the year ending March 2026 on Community Safety
    Partnership 2023 codes for England and Wales, as offence counts excluding fraud; offences unassigned
    to a partnership are not included, so partnership sums fall short of force and national totals.
    `unemployment-rate` and `unemployment-level` are ONS's final model-based estimates for Great Britain
    with 95% confidence intervals, on Local Authority 2019 codes for every period from 1996-97 to 2021
    and on Local Authority 2021 codes for 2020 and 2021; periods to 2003-04 are financial years.
    `no2-background-mean`, `pm10-background-mean` and `pm25-background-mean` cover 2024 Local Authority
    2024 codes across all four nations, as area means of Defra's 1x1 km PCM background maps, derived by
    this Atlas and aggregated weighted by `air-quality-grid-cells`; `pm25-population-weighted` and its
    `-anthropogenic` part are Defra's published population-weighted concentrations. This route never
    selects a May/December boundary release, converts values between geographies, or aggregates them. By
    default, it serves publisher-reported values and any reviewed, documented code-only repairs. A
    caller may ask for `units=canonical` to multiply numeric values and any published interval bounds by
    the measure's declared canonical scale. That response identifies the calculation and canonical unit;
    it never changes an observation artifact. A caller may supply `release` only when the compatibility
    report proves that every source code is present; the response identifies that caller-selected code
    join. `GET /measures/{measure-id}` declares valid period/geography combinations, and `GET
    /documents/measure-{measure-id}.json` declares eligible releases. The geography may be left out when
    `place` names an area, by name or code, or the measure is published on one; the boundary year and
    period then default to the newest partition and its latest period, stated in `defaults`. Every
    response includes compact provenance linking the immutable Atlas release, measure, source dataset
    and observation artifact, along with the selected geography match and an explicit statement that no
    transformation has been applied.

    Args:
        measure_id (str):
        period (str | Unset):
        geography (GetMeasureObservationsGeography | Unset):
        code_year (int | Unset):
        release (str | Unset):
        place (str | Unset):
        include (GetMeasureObservationsInclude | Unset):
        format_ (GetMeasureObservationsFormat | Unset):  Default:
            GetMeasureObservationsFormat.JSON.
        units (GetMeasureObservationsUnits | Unset):  Default: GetMeasureObservationsUnits.SOURCE.
        limit (int | Unset):  Default: 100.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AmbiguousPlaceProblem | Envelope | Problem
    """

    return (
        await asyncio_detailed(
            measure_id=measure_id,
            client=client,
            period=period,
            geography=geography,
            code_year=code_year,
            release=release,
            place=place,
            include=include,
            format_=format_,
            units=units,
            limit=limit,
            cursor=cursor,
        )
    ).parsed
