from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.terrain_point_source_crs import TerrainPointSourceCrs
from ..models.terrain_point_source_horizontal_datum import (
    TerrainPointSourceHorizontalDatum,
)
from ..models.terrain_point_source_horizontal_transformation import (
    TerrainPointSourceHorizontalTransformation,
)
from ..models.terrain_point_source_provenance import TerrainPointSourceProvenance
from ..models.terrain_point_source_vertical_datum import TerrainPointSourceVerticalDatum
from ..models.terrain_point_source_vertical_model import TerrainPointSourceVerticalModel
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.terrain_point_source_coverage import TerrainPointSourceCoverage
    from ..models.terrain_point_source_uncertainty import TerrainPointSourceUncertainty


T = TypeVar("T", bound="TerrainPointSource")


@_attrs_define
class TerrainPointSource:
    """
    Attributes:
        content_hash (str):
        coverage (TerrainPointSourceCoverage):
        crs (TerrainPointSourceCrs):
        horizontal_datum (TerrainPointSourceHorizontalDatum):
        id (str):
        no_data (float | None):
        resolution_metres (float):
        tile_hash (str):
        uncertainty (TerrainPointSourceUncertainty):
        version (str):
        vertical_datum (TerrainPointSourceVerticalDatum):
        horizontal_transformation (TerrainPointSourceHorizontalTransformation | Unset):
        provenance (TerrainPointSourceProvenance | Unset):
        vertical_model (TerrainPointSourceVerticalModel | Unset):
    """

    content_hash: str
    coverage: TerrainPointSourceCoverage
    crs: TerrainPointSourceCrs
    horizontal_datum: TerrainPointSourceHorizontalDatum
    id: str
    no_data: float | None
    resolution_metres: float
    tile_hash: str
    uncertainty: TerrainPointSourceUncertainty
    version: str
    vertical_datum: TerrainPointSourceVerticalDatum
    horizontal_transformation: TerrainPointSourceHorizontalTransformation | Unset = (
        UNSET
    )
    provenance: TerrainPointSourceProvenance | Unset = UNSET
    vertical_model: TerrainPointSourceVerticalModel | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        coverage = self.coverage.to_dict()

        crs = self.crs.value

        horizontal_datum = self.horizontal_datum.value

        id = self.id

        no_data: float | None
        no_data = self.no_data

        resolution_metres = self.resolution_metres

        tile_hash = self.tile_hash

        uncertainty = self.uncertainty.to_dict()

        version = self.version

        vertical_datum = self.vertical_datum.value

        horizontal_transformation: str | Unset = UNSET
        if not isinstance(self.horizontal_transformation, Unset):
            horizontal_transformation = self.horizontal_transformation.value

        provenance: str | Unset = UNSET
        if not isinstance(self.provenance, Unset):
            provenance = self.provenance.value

        vertical_model: str | Unset = UNSET
        if not isinstance(self.vertical_model, Unset):
            vertical_model = self.vertical_model.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "coverage": coverage,
                "crs": crs,
                "horizontalDatum": horizontal_datum,
                "id": id,
                "noData": no_data,
                "resolutionMetres": resolution_metres,
                "tileHash": tile_hash,
                "uncertainty": uncertainty,
                "version": version,
                "verticalDatum": vertical_datum,
            }
        )
        if horizontal_transformation is not UNSET:
            field_dict["horizontalTransformation"] = horizontal_transformation
        if provenance is not UNSET:
            field_dict["provenance"] = provenance
        if vertical_model is not UNSET:
            field_dict["verticalModel"] = vertical_model

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.terrain_point_source_coverage import TerrainPointSourceCoverage
        from ..models.terrain_point_source_uncertainty import (
            TerrainPointSourceUncertainty,
        )

        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        coverage = TerrainPointSourceCoverage.from_dict(d.pop("coverage"))

        crs = TerrainPointSourceCrs(d.pop("crs"))

        horizontal_datum = TerrainPointSourceHorizontalDatum(d.pop("horizontalDatum"))

        id = d.pop("id")

        def _parse_no_data(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        no_data = _parse_no_data(d.pop("noData"))

        resolution_metres = d.pop("resolutionMetres")

        tile_hash = d.pop("tileHash")

        uncertainty = TerrainPointSourceUncertainty.from_dict(d.pop("uncertainty"))

        version = d.pop("version")

        vertical_datum = TerrainPointSourceVerticalDatum(d.pop("verticalDatum"))

        _horizontal_transformation = d.pop("horizontalTransformation", UNSET)
        horizontal_transformation: TerrainPointSourceHorizontalTransformation | Unset
        if isinstance(_horizontal_transformation, Unset):
            horizontal_transformation = UNSET
        else:
            horizontal_transformation = TerrainPointSourceHorizontalTransformation(
                _horizontal_transformation
            )

        _provenance = d.pop("provenance", UNSET)
        provenance: TerrainPointSourceProvenance | Unset
        if isinstance(_provenance, Unset):
            provenance = UNSET
        else:
            provenance = TerrainPointSourceProvenance(_provenance)

        _vertical_model = d.pop("verticalModel", UNSET)
        vertical_model: TerrainPointSourceVerticalModel | Unset
        if isinstance(_vertical_model, Unset):
            vertical_model = UNSET
        else:
            vertical_model = TerrainPointSourceVerticalModel(_vertical_model)

        terrain_point_source = cls(
            content_hash=content_hash,
            coverage=coverage,
            crs=crs,
            horizontal_datum=horizontal_datum,
            id=id,
            no_data=no_data,
            resolution_metres=resolution_metres,
            tile_hash=tile_hash,
            uncertainty=uncertainty,
            version=version,
            vertical_datum=vertical_datum,
            horizontal_transformation=horizontal_transformation,
            provenance=provenance,
            vertical_model=vertical_model,
        )

        terrain_point_source.additional_properties = d
        return terrain_point_source

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
