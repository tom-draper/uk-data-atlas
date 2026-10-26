from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.area_metrics_label_point_method import AreaMetricsLabelPointMethod

if TYPE_CHECKING:
    from ..models.area_metrics_area import AreaMetricsArea
    from ..models.area_metrics_geometry_extent import AreaMetricsGeometryExtent
    from ..models.area_metrics_method import AreaMetricsMethod
    from ..models.area_metrics_perimeter import AreaMetricsPerimeter
    from ..models.geometry_source import GeometrySource


T = TypeVar("T", bound="AreaMetrics")


@_attrs_define
class AreaMetrics:
    """Present only with `include=metrics`; measurements of the area's published boundary, with the method that produced
    them.

        Attributes:
            area (AreaMetricsArea): One measurement, in three units.
            bounding_box (list[float]): [minLongitude, minLatitude, maxLongitude, maxLatitude] in WGS 84.
            centroid (list[float]): [longitude, latitude] in WGS 84.
            geometry_extent (AreaMetricsGeometryExtent): How much geometry stands behind the measurements: a mainland and
                its islands are many parts, and a ring of land has more rings than parts.
            geometry_hash (str): SHA-256 of the UTF-8 JSON serialization of the full WGS 84 geometry returned by the area's
                geometry route with tier=full. This identifies its coordinates and their order, not topological equivalence.
            geometry_source (GeometrySource): Where the served WGS84 geometry came from. `transformation` is present only
                when the source was reprojected. Per-area compiled geometry carries `validity`; release-wide provenance and
                direct source reads omit it.
            label_point (list[float]): [longitude, latitude] in WGS 84, always inside the geometry.
            label_point_method (AreaMetricsLabelPointMethod): `centroid` when the centre of area lies inside the geometry,
                `interior-span` when it does not and a point inside was chosen instead.
            method (AreaMetricsMethod): The projection and rule behind each figure, carried with the response so a
                measurement can be read on its own.
            perimeter (AreaMetricsPerimeter):
    """

    area: AreaMetricsArea
    bounding_box: list[float]
    centroid: list[float]
    geometry_extent: AreaMetricsGeometryExtent
    geometry_hash: str
    geometry_source: GeometrySource
    label_point: list[float]
    label_point_method: AreaMetricsLabelPointMethod
    method: AreaMetricsMethod
    perimeter: AreaMetricsPerimeter
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area = self.area.to_dict()

        bounding_box = self.bounding_box

        centroid = self.centroid

        geometry_extent = self.geometry_extent.to_dict()

        geometry_hash = self.geometry_hash

        geometry_source = self.geometry_source.to_dict()

        label_point = self.label_point

        label_point_method = self.label_point_method.value

        method = self.method.to_dict()

        perimeter = self.perimeter.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "area": area,
                "boundingBox": bounding_box,
                "centroid": centroid,
                "geometryExtent": geometry_extent,
                "geometryHash": geometry_hash,
                "geometrySource": geometry_source,
                "labelPoint": label_point,
                "labelPointMethod": label_point_method,
                "method": method,
                "perimeter": perimeter,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_metrics_area import AreaMetricsArea
        from ..models.area_metrics_geometry_extent import AreaMetricsGeometryExtent
        from ..models.area_metrics_method import AreaMetricsMethod
        from ..models.area_metrics_perimeter import AreaMetricsPerimeter
        from ..models.geometry_source import GeometrySource

        d = dict(src_dict)
        area = AreaMetricsArea.from_dict(d.pop("area"))

        bounding_box = cast(list[float], d.pop("boundingBox"))

        centroid = cast(list[float], d.pop("centroid"))

        geometry_extent = AreaMetricsGeometryExtent.from_dict(d.pop("geometryExtent"))

        geometry_hash = d.pop("geometryHash")

        geometry_source = GeometrySource.from_dict(d.pop("geometrySource"))

        label_point = cast(list[float], d.pop("labelPoint"))

        label_point_method = AreaMetricsLabelPointMethod(d.pop("labelPointMethod"))

        method = AreaMetricsMethod.from_dict(d.pop("method"))

        perimeter = AreaMetricsPerimeter.from_dict(d.pop("perimeter"))

        area_metrics = cls(
            area=area,
            bounding_box=bounding_box,
            centroid=centroid,
            geometry_extent=geometry_extent,
            geometry_hash=geometry_hash,
            geometry_source=geometry_source,
            label_point=label_point,
            label_point_method=label_point_method,
            method=method,
            perimeter=perimeter,
        )

        area_metrics.additional_properties = d
        return area_metrics

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
