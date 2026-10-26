import json

import httpx
import pytest

from uk_data_atlas_client import AtlasClient, AtlasError


def atlas(handler):
    return AtlasClient(
        "http://atlas.test/v1", httpx_args={"transport": httpx.MockTransport(handler)}
    )


def envelope(data):
    return {
        "apiVersion": "v1",
        "atlasRelease": "sha256:test",
        "data": data,
        "meta": {"nextCursor": None},
    }


def test_value_asks_the_value_route_and_returns_the_envelope():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url)
        return httpx.Response(200, json=envelope({"answer": {"value": 697115}}))

    result = atlas(handler).value("population", "north wales", period="2024")

    assert (
        str(seen[0]) == "http://atlas.test/v1/data/population/value?place=north+wales&period=2024"
    )
    assert result.atlas_release == "sha256:test"
    assert result["data"]["answer"]["value"] == 697115


def test_places_and_measures_pass_the_search_text():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.params["q"])
        return httpx.Response(200, json=envelope([]))

    client = atlas(handler)
    client.places("Newport")
    client.measures("house prices")

    assert seen == ["Newport", "house prices"]


def test_a_refusal_raises_with_the_problem():
    problem = {
        "type": "https://api.ukdataatlas.com/problems/ambiguous-place",
        "title": "Ambiguous Place",
        "status": 409,
        "detail": "Newport could mean 13 places.",
        "code": "ambiguous_place",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            409, content=json.dumps(problem), headers={"content-type": "application/problem+json"}
        )

    with pytest.raises(AtlasError) as raised:
        atlas(handler).value("population", "Newport")

    assert raised.value.status_code == 409
    assert raised.value.code == "ambiguous_place"
    assert raised.value.problem["detail"] == "Newport could mean 13 places."


def test_a_failure_without_a_problem_still_raises():
    with pytest.raises(AtlasError) as raised:
        atlas(lambda request: httpx.Response(502, text="Bad Gateway")).postcode("SW1A 1AA")

    assert raised.value.status_code == 502
    assert raised.value.problem == {}


def test_a_described_route_returns_a_typed_model():
    body = envelope(
        {
            "postcode": "SW1A 1AA",
            "status": "live",
            "introduced": "1980-01",
            "userType": "large",
            "country": "E92000001",
            "centroid": {
                "crs": "EPSG:27700",
                "easting": 529090,
                "northing": 179645,
                "positionalQuality": {"indicator": 1, "description": "d", "accuracyM": 0.5},
            },
            "point": {
                "lng": -0.141588,
                "lat": 51.501009,
                "crs": "EPSG:4326",
                "precision": {"uncertaintyM": 2.5, "basis": "decimal-places-and-transformation"},
            },
            "date": "2026-08",
            "dateBasis": "directory-edition",
            "pointCountry": {"code": "GB-ENG", "determinedBy": "area-code"},
            "boundaryRule": "included",
            "results": [
                {
                    "geography": "localAuthority",
                    "boundaryRelease": "2026-05-uk-bgc",
                    "status": "matched",
                    "matches": [
                        {
                            "id": "localAuthority/2026-05-uk-bgc/E09000033",
                            "code": "E09000033",
                            "name": "Westminster",
                            "nearBoundary": False,
                        }
                    ],
                }
            ],
            "source": {
                "title": "ONS Postcode Directory (August 2026)",
                "edition": "2026-08",
                "publisher": "Office for National Statistics",
                "attribution": ["Contains OS data"],
            },
        }
    )

    lookup = atlas(lambda request: httpx.Response(200, json=body)).postcode("SW1A 1AA")

    assert lookup.data.results[0].matches[0].name == "Westminster"
