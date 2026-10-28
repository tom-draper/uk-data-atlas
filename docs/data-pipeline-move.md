# Data pipeline move plan

This is the first PR in an incremental migration. It moves the atlas pages and
lookups release path first. The observation row pilot stays unchanged.

The postcode index builder and compiler now live in
`pipeline/src/build-postcode-index.ts` and `pipeline/src/postcodeIndex.ts`.
The API and compiler share postcode rules in `packages/geography/src/postcodeRules.ts`.

## Inventory

Classification uses codeq import edges for every script and src module on the
starting branch. Build roots are the build, store, fetch, crosswalk worker,
pack, extract and write scripts. Runtime roots include serve, smoke, API schema,
audit, benchmark, profile and compare tooling, runtime bundling, query rule
generation, README indexing and local API cache generation. Build roots exclude
these API tools. Helper scripts inherit their callers' classification. Both
means reachable from both
sets, including tooling. Unreached src modules remain runtime-only until a later
compiler group proves otherwise. Imports are name-based evidence, not proof
that every function in a module is needed by both callers.

| File under services/api                          | Classification |
| ------------------------------------------------ | -------------- |
| `scripts/audit-archive.mjs`                      | runtime-only   |
| `scripts/benchmark-map-resource.ts`              | runtime-only   |
| `scripts/benchmark-measure-lookup.ts`            | runtime-only   |
| `scripts/benchmark-observation-tables.ts`        | runtime-only   |
| `scripts/benchmark-parquet.ts`                   | runtime-only   |
| `scripts/benchmark-series.ts`                    | runtime-only   |
| `scripts/build-analysis-geographies.ts`          | build-only     |
| `scripts/build-analysis-geography-validation.ts` | build-only     |
| `scripts/build-api-surface.ts`                   | runtime-only   |
| `scripts/build-area-inventory.ts`                | build-only     |
| `scripts/build-area-search-index.ts`             | both           |
| `scripts/build-atlas-cache.ts`                   | runtime-only   |
| `scripts/build-atlas-lookups.ts`                 | build-only     |
| `scripts/build-atlas-pages.ts`                   | build-only     |
| `scripts/build-atlas-release.ts`                 | build-only     |
| `scripts/build-atlas-sqlite.ts`                  | build-only     |
| `scripts/build-boundary-registry.ts`             | build-only     |
| `scripts/build-crosswalk-inventory.ts`           | build-only     |
| `scripts/build-data-catalog.ts`                  | build-only     |
| `scripts/build-derived-boundaries.ts`            | build-only     |
| `scripts/build-docs-catalogue.ts`                | build-only     |
| `scripts/build-evidence-documents.ts`            | build-only     |
| `scripts/build-export-manifest.ts`               | build-only     |
| `scripts/build-geography-catalogues.ts`          | build-only     |
| `scripts/build-geography-inventory.ts`           | build-only     |
| `scripts/build-geometry-source-registry.ts`      | build-only     |
| `scripts/build-geometry-store.ts`                | build-only     |
| `scripts/build-location-projections.ts`          | build-only     |
| `scripts/build-lookup-manifest.ts`               | build-only     |
| `scripts/build-map-resource.ts`                  | build-only     |
| `scripts/build-measure-compatibility.ts`         | build-only     |
| `scripts/build-named-locations.ts`               | build-only     |
| `scripts/build-operations.ts`                    | build-only     |
| `scripts/build-place-index.ts`                   | both           |
| `scripts/build-postcode-areas.ts`                | build-only     |
| `scripts/build-postcode-counts.ts`               | both           |
| `scripts/build-postcode-index.ts`                | build-only     |
| `scripts/build-query-rules.ts`                   | runtime-only   |
| `scripts/build-readme-index.ts`                  | runtime-only   |
| `scripts/build-relationship-candidates.ts`       | build-only     |
| `scripts/build-relationship-paths.ts`            | build-only     |
| `scripts/build-runtime.mjs`                      | runtime-only   |
| `scripts/build-terrain-catalogue.ts`             | build-only     |
| `scripts/build-validation-report.ts`             | build-only     |
| `scripts/compare-atlas-cache.ts`                 | runtime-only   |
| `scripts/compare-atlas-sqlite.ts`                | runtime-only   |
| `scripts/compare-postcode-sqlite.ts`             | runtime-only   |
| `scripts/compileGeometryValidity.ts`             | build-only     |
| `scripts/crosswalk-artifact.ts`                  | both           |
| `scripts/crosswalk-build-inputs.ts`              | both           |
| `scripts/crosswalk-worker.ts`                    | build-only     |
| `scripts/crosswalk-workers.ts`                   | both           |
| `scripts/extract-ons-ward-history.ts`            | build-only     |
| `scripts/fetch-ons-boundaries.ts`                | build-only     |
| `scripts/fetch-ons-lookup.ts`                    | build-only     |
| `scripts/fetch-onspd.ts`                         | build-only     |
| `scripts/fetch-scottish-lookup.ts`               | build-only     |
| `scripts/geography-build-path.ts`                | both           |
| `scripts/memory-profile/workload.ts`             | runtime-only   |
| `scripts/onsBoundarySources.ts`                  | build-only     |
| `scripts/pack-named-locations.ts`                | build-only     |
| `scripts/profile-atlas-cache-http.ts`            | runtime-only   |
| `scripts/profile-crosswalks.ts`                  | runtime-only   |
| `scripts/profile-memory.ts`                      | runtime-only   |
| `scripts/profile-startup.ts`                     | runtime-only   |
| `scripts/propose-extent-continuity.ts`           | build-only     |
| `scripts/propose-geometric-containment.ts`       | build-only     |
| `scripts/refresh-problem-examples.ts`            | runtime-only   |
| `scripts/serve.ts`                               | runtime-only   |
| `scripts/smoke.ts`                               | runtime-only   |
| `scripts/store-observations.ts`                  | build-only     |
| `scripts/store-postcode-derived.ts`              | both           |
| `scripts/store-postcode-index.ts`                | build-only     |
| `scripts/write-atlas-pages.ts`                   | build-only     |
| `src/aggregateObservations.ts`                   | runtime-only   |
| `src/aggregatePreparation.ts`                    | runtime-only   |
| `src/aggregateQuery.ts`                          | runtime-only   |
| `src/aggregateResponse.ts`                       | runtime-only   |
| `src/aggregateTargetMembers.ts`                  | runtime-only   |
| `src/aggregation.ts`                             | runtime-only   |
| `src/aggregationCompatibility.ts`                | runtime-only   |
| `src/aggregationCoverage.ts`                     | runtime-only   |
| `src/aggregationLocation.ts`                     | runtime-only   |
| `src/aggregationMeasure.ts`                      | runtime-only   |
| `src/aggregationMembership.ts`                   | runtime-only   |
| `src/aggregationPartition.ts`                    | runtime-only   |
| `src/aggregationTarget.ts`                       | runtime-only   |
| `src/analysisGeographies.ts`                     | both           |
| `src/analysisGeographyRoutes.ts`                 | both           |
| `src/analysisGeographyValidation.ts`             | both           |
| `src/apiMetrics.ts`                              | runtime-only   |
| `src/apiServer.ts`                               | runtime-only   |
| `src/apiSurface.ts`                              | runtime-only   |
| `src/areaAbsence.ts`                             | both           |
| `src/areaAdapters.ts`                            | both           |
| `src/areaCapabilityRoutes.ts`                    | runtime-only   |
| `src/areaChildGeometryRoutes.ts`                 | runtime-only   |
| `src/areaChildren.ts`                            | runtime-only   |
| `src/areaCitationRoutes.ts`                      | runtime-only   |
| `src/areaContainment.ts`                         | both           |
| `src/areaContainsRoutes.ts`                      | runtime-only   |
| `src/areaDistance.ts`                            | both           |
| `src/areaDossierRoutes.ts`                       | runtime-only   |
| `src/areaGeometry.ts`                            | both           |
| `src/areaGeometryMetadataRoutes.ts`              | runtime-only   |
| `src/areaGeometryPieces.ts`                      | both           |
| `src/areaGeometryRoutes.ts`                      | runtime-only   |
| `src/areaHistoryRoutes.ts`                       | runtime-only   |
| `src/areaIdentityRoutes.ts`                      | runtime-only   |
| `src/areaIntersectsRoutes.ts`                    | runtime-only   |
| `src/areaInventory.ts`                           | both           |
| `src/areaMetrics.ts`                             | runtime-only   |
| `src/areaNearRoutes.ts`                          | runtime-only   |
| `src/areaNeighbourRoutes.ts`                     | runtime-only   |
| `src/areaNeighbours.ts`                          | both           |
| `src/areaOverlap.ts`                             | both           |
| `src/areaOverlapRoutes.ts`                       | runtime-only   |
| `src/areaRelationshipRoutes.ts`                  | runtime-only   |
| `src/areaRelationships.ts`                       | both           |
| `src/areaResolveRoutes.ts`                       | runtime-only   |
| `src/areaResources.ts`                           | both           |
| `src/areaSearch.ts`                              | both           |
| `src/areaSearchRoutes.ts`                        | runtime-only   |
| `src/areaSourceAdapters.ts`                      | both           |
| `src/areaValidationRoutes.ts`                    | runtime-only   |
| `src/atlasAreas.ts`                              | both           |
| `src/atlasCache.ts`                              | both           |
| `src/atlasCrosswalks.ts`                         | both           |
| `src/atlasLookups.ts`                            | both           |
| `src/atlasNamedLocations.ts`                     | both           |
| `src/atlasObservationTables.ts`                  | build-only     |
| `src/atlasObservations.ts`                       | both           |
| `src/atlasPages.ts`                              | both           |
| `src/atlasPostcodeAreas.ts`                      | both           |
| `src/atlasPostcodeDerived.ts`                    | both           |
| `src/atlasPostcodes.ts`                          | both           |
| `src/atlasRelease.ts`                            | both           |
| `src/attribution.ts`                             | both           |
| `src/batchInput.ts`                              | both           |
| `src/batchValidation.ts`                         | both           |
| `src/boundaryLoader.ts`                          | both           |
| `src/boundaryRegistry.ts`                        | both           |
| `src/boundaryRoutes.ts`                          | runtime-only   |
| `src/boundedClipping.ts`                         | both           |
| `src/bulkRoutes.ts`                              | runtime-only   |
| `src/canonicalRequests.ts`                       | runtime-only   |
| `src/capability.ts`                              | both           |
| `src/catalog/airQuality.ts`                      | build-only     |
| `src/catalog/authorityChanges.ts`                | build-only     |
| `src/catalog/broadband.ts`                       | build-only     |
| `src/catalog/census.ts`                          | build-only     |
| `src/catalog/censusSmallArea.ts`                 | build-only     |
| `src/catalog/claimantCount.ts`                   | build-only     |
| `src/catalog/compileDataCatalog.ts`              | build-only     |
| `src/catalog/countries.ts`                       | both           |
| `src/catalog/crime.ts`                           | build-only     |
| `src/catalog/deprivation.ts`                     | build-only     |
| `src/catalog/elections.ts`                       | build-only     |
| `src/catalog/emissions.ts`                       | build-only     |
| `src/catalog/energyConsumption.ts`               | build-only     |
| `src/catalog/homelessness.ts`                    | build-only     |
| `src/catalog/housePrice.ts`                      | build-only     |
| `src/catalog/income.ts`                          | build-only     |
| `src/catalog/indicators.ts`                      | build-only     |
| `src/catalog/input.ts`                           | build-only     |
| `src/catalog/jobs.ts`                            | build-only     |
| `src/catalog/lifeExpectancy.ts`                  | build-only     |
| `src/catalog/localAuthorityFields.ts`            | build-only     |
| `src/catalog/manifest.ts`                        | build-only     |
| `src/catalog/measureAliases.ts`                  | build-only     |
| `src/catalog/mobileCoverage.ts`                  | build-only     |
| `src/catalog/nationalVariants.ts`                | build-only     |
| `src/catalog/newDatasets.ts`                     | build-only     |
| `src/catalog/nimdm.ts`                           | build-only     |
| `src/catalog/population.ts`                      | build-only     |
| `src/catalog/populationDensity.ts`               | build-only     |
| `src/catalog/regionalGdp.ts`                     | build-only     |
| `src/catalog/roadCollisions.ts`                  | build-only     |
| `src/catalog/unemployment.ts`                    | build-only     |
| `src/catalog/values.ts`                          | build-only     |
| `src/catalogueLoader.ts`                         | both           |
| `src/catalogueManifestLoader.ts`                 | both           |
| `src/catalogueObservationTables.ts`              | build-only     |
| `src/catalogueRoutes.ts`                         | runtime-only   |
| `src/ceremonialCounties.ts`                      | build-only     |
| `src/change.ts`                                  | runtime-only   |
| `src/clusterMetrics.ts`                          | runtime-only   |
| `src/comparison.ts`                              | runtime-only   |
| `src/contentHash.ts`                             | both           |
| `src/conversion.ts`                              | both           |
| `src/coordinateRoutes.ts`                        | runtime-only   |
| `src/correctionRegister.ts`                      | both           |
| `src/coveragePlan.ts`                            | both           |
| `src/coveragePlanRoutes.ts`                      | both           |
| `src/crosswalkAdapters.ts`                       | both           |
| `src/crosswalkConversionRoutes.ts`               | runtime-only   |
| `src/crosswalkGeometryValidation.ts`             | both           |
| `src/crosswalkInventory.ts`                      | both           |
| `src/crosswalkLoader.ts`                         | both           |
| `src/crosswalkRoutes.ts`                         | runtime-only   |
| `src/crosswalkSpatialIndex.ts`                   | both           |
| `src/crosswalkValidation.ts`                     | both           |
| `src/csv.ts`                                     | both           |
| `src/dataAggregateRoutes.ts`                     | runtime-only   |
| `src/dataCatalog.ts`                             | both           |
| `src/dataChangeRoutes.ts`                        | runtime-only   |
| `src/dataConversionRoutes.ts`                    | runtime-only   |
| `src/dataDefaults.ts`                            | runtime-only   |
| `src/dataRankingRoutes.ts`                       | runtime-only   |
| `src/dataRoutes.ts`                              | runtime-only   |
| `src/dataSeriesRoutes.ts`                        | runtime-only   |
| `src/dataTransformRoutes.ts`                     | runtime-only   |
| `src/dataValueRoutes.ts`                         | runtime-only   |
| `src/dbf.ts`                                     | both           |
| `src/docsPage.ts`                                | runtime-only   |
| `src/documentRoutes.ts`                          | runtime-only   |
| `src/evidenceReports.ts`                         | both           |
| `src/exportManifest.ts`                          | both           |
| `src/extentContinuity.ts`                        | both           |
| `src/fileHashCache.ts`                           | both           |
| `src/flatDownloads.ts`                           | build-only     |
| `src/fullDetailDownloads.ts`                     | both           |
| `src/geoJsonProperties.ts`                       | both           |
| `src/geography.ts`                               | both           |
| `src/geographyCatalogue.ts`                      | both           |
| `src/geographyHealthRoutes.ts`                   | both           |
| `src/geographyInventory.ts`                      | both           |
| `src/geographyKeys.ts`                           | both           |
| `src/geographyResolver.ts`                       | both           |
| `src/geometricContainment.ts`                    | both           |
| `src/geometryBudget.ts`                          | runtime-only   |
| `src/geometryLoader.ts`                          | both           |
| `src/geometryPositions.ts`                       | both           |
| `src/geometrySourceRegistry.ts`                  | build-only     |
| `src/geometrySources.ts`                         | both           |
| `src/geometrySpatialIndex.ts`                    | both           |
| `src/geometryStore.ts`                           | both           |
| `src/geometrySubstitution.ts`                    | both           |
| `src/geometryValidity.ts`                        | both           |
| `src/governanceLoader.ts`                        | both           |
| `src/governanceRoutes.ts`                        | both           |
| `src/gridOffset.ts`                              | both           |
| `src/httpResponse.ts`                            | runtime-only   |
| `src/indexRoutes.ts`                             | runtime-only   |
| `src/lazyValue.ts`                               | both           |
| `src/locationAggregation.ts`                     | runtime-only   |
| `src/locationLoader.ts`                          | both           |
| `src/locationMembership.ts`                      | both           |
| `src/locationProjections.ts`                     | both           |
| `src/locationRoutes.ts`                          | runtime-only   |
| `src/lookupExports.ts`                           | both           |
| `src/mapResource/archiveReader.ts`               | both           |
| `src/mapResource/compileMapResource.ts`          | both           |
| `src/mapResource/fullDetail.ts`                  | both           |
| `src/mapResource/geoJson.ts`                     | both           |
| `src/mapResource/geoParquet.ts`                  | both           |
| `src/mapResourceLoader.ts`                       | both           |
| `src/mapResourceRoutes.ts`                       | runtime-only   |
| `src/matchReport.ts`                             | runtime-only   |
| `src/measureCapability.ts`                       | both           |
| `src/measureCompatibility.ts`                    | both           |
| `src/measureCompatibilityRoutes.ts`              | both           |
| `src/measureCoverage.ts`                         | both           |
| `src/measureCoverageRoutes.ts`                   | both           |
| `src/measureQualityRoutes.ts`                    | both           |
| `src/measureReconciliation.ts`                   | both           |
| `src/measureReconciliationRoutes.ts`             | both           |
| `src/measureTerms.ts`                            | both           |
| `src/memberReconciliation.ts`                    | both           |
| `src/nameNormalisation.ts`                       | both           |
| `src/namedLocationGeometry.ts`                   | both           |
| `src/namedLocationStorage.ts`                    | build-only     |
| `src/namedLocations.ts`                          | both           |
| `src/numericObservations.ts`                     | runtime-only   |
| `src/observationArtifacts.ts`                    | both           |
| `src/observationDownloads.ts`                    | both           |
| `src/observationLoader.ts`                       | both           |
| `src/observationResolution/observationPlan.ts`   | runtime-only   |
| `src/observationTables.ts`                       | both           |
| `src/openapiRoutes.ts`                           | runtime-only   |
| `src/operationTemplates.ts`                      | both           |
| `src/packedGeometry.ts`                          | both           |
| `src/pagination.ts`                              | runtime-only   |
| `src/pairOverlap.ts`                             | runtime-only   |
| `src/parquet.ts`                                 | both           |
| `src/pieceIntersection.ts`                       | both           |
| `src/placeIndex.ts`                              | both           |
| `src/placeParameter.ts`                          | runtime-only   |
| `src/placeResolver.ts`                           | both           |
| `src/placeResponses.ts`                          | runtime-only   |
| `src/placeRoutes.ts`                             | runtime-only   |
| `src/placeValue.ts`                              | both           |
| `src/pointLookup.ts`                             | both           |
| `src/populationOverlap.ts`                       | both           |
| `src/postcodeAreas.ts`                           | both           |
| `src/postcodeCounts.ts`                          | both           |
| `src/postcodeRoutes.ts`                          | both           |
| `src/postcodeValue.ts`                           | both           |
| `src/postcodes.ts`                               | both           |
| `src/problemCodes.ts`                            | both           |
| `src/publicJson.ts`                              | both           |
| `src/publicManifest.ts`                          | both           |
| `src/queryParameters.ts`                         | both           |
| `src/queryRuleCompiler.ts`                       | both           |
| `src/queryRules.ts`                              | both           |
| `src/ranking.ts`                                 | runtime-only   |
| `src/rateLimit.ts`                               | runtime-only   |
| `src/rawAreaGeometries.ts`                       | both           |
| `src/relatedCodes.ts`                            | both           |
| `src/relationshipCandidates.ts`                  | both           |
| `src/relationshipCapabilityRoutes.ts`            | runtime-only   |
| `src/relationshipCoverageRoutes.ts`              | runtime-only   |
| `src/relationshipPathAdapters.ts`                | build-only     |
| `src/relationshipPaths.ts`                       | both           |
| `src/relationshipRepairRoutes.ts`                | both           |
| `src/relationshipRoutes.ts`                      | runtime-only   |
| `src/releaseForDate.ts`                          | both           |
| `src/releaseJoinRoutes.ts`                       | runtime-only   |
| `src/reprojection.ts`                            | both           |
| `src/requestRows.ts`                             | runtime-only   |
| `src/resolver/areas.ts`                          | both           |
| `src/resolver/capability.ts`                     | both           |
| `src/resolver/catalogue.ts`                      | both           |
| `src/resolver/conversionCapability.ts`           | both           |
| `src/resolver/lineage.ts`                        | both           |
| `src/resolver/locations.ts`                      | both           |
| `src/resolver/releaseComparison.ts`              | both           |
| `src/resolver/spatial.ts`                        | both           |
| `src/resolver/translation.ts`                    | both           |
| `src/responseCache.ts`                           | runtime-only   |
| `src/routeHandlers.ts`                           | runtime-only   |
| `src/routeResponse.ts`                           | both           |
| `src/routes.ts`                                  | runtime-only   |
| `src/routing.ts`                                 | both           |
| `src/server.ts`                                  | runtime-only   |
| `src/serverOptions.ts`                           | runtime-only   |
| `src/shapefile.ts`                               | both           |
| `src/sortedIndex.ts`                             | both           |
| `src/sourceExactProvenance.ts`                   | both           |
| `src/sourceInventory.ts`                         | both           |
| `src/sourcePartition.ts`                         | runtime-only   |
| `src/sqliteIndex.ts`                             | both           |
| `src/storedText.ts`                              | both           |
| `src/suppliedConversion.ts`                      | runtime-only   |
| `src/syncRoutes.ts`                              | both           |
| `src/tabularExport.ts`                           | runtime-only   |
| `src/terrainCatalogue.ts`                        | both           |
| `src/terrainLoader.ts`                           | both           |
| `src/terrainProvider.ts`                         | both           |
| `src/terrainRoutes.ts`                           | runtime-only   |
| `src/translationRoutes.ts`                       | runtime-only   |
| `src/unitRegistry.ts`                            | both           |
| `src/validation/atlasFindings.ts`                | build-only     |
| `src/validation/boundaryReleaseFindings.ts`      | build-only     |
| `src/validation/compileValidationReport.ts`      | build-only     |
| `src/validation/crosswalkFindings.ts`            | build-only     |
| `src/validation/findings.ts`                     | build-only     |
| `src/validation/inputs.ts`                       | build-only     |
| `src/validation/measureFindings.ts`              | build-only     |
| `src/validation/measureSourceFindings.ts`        | build-only     |
| `src/validation/sourceGeography.ts`              | build-only     |
| `src/validationReport.ts`                        | both           |
| `src/weightedAggregation.ts`                     | runtime-only   |
| `src/weightedMean.ts`                            | runtime-only   |
| `src/weightedSource.ts`                          | runtime-only   |

## Move order

1. Establish the pipeline workspace and move the asset assembly stage without
   changing its bytes. Then redirect existing page and lookup producers into
   `data/build/atlas-assets/`, make API readers use those release files, and
   stop Next.js builds importing API output. Enforce pipeline and product
   import boundaries. The page and lookup compiler entry points remain in
   API scripts for this first PR because they still use catalogueLoader.
   Keep other API public outputs in place until their compiler groups move.
2. Move independent catalogue builders and helpers, one stage group per commit.
3. Split catalogueLoader and other both modules into shared runtime readers and
   pipeline compilers. Move geometry, crosswalk and named location builders.
4. Move remaining dataset, download, SQLite and release builders. Leave API
   serve, smoke, schema, audit, benchmark, profile and compare tools in place.

Pure moves and import rewrites precede output-path behavior changes in separate
commits. Each group compares stage outputs before and after with only one heavy
process and no Node heap above 3072 MiB. Cache tracing must follow moved imports;
declared codeInputs cover workers and other dynamically loaded code.

## Extraction progress

The terrain catalogue compiler and entry point now live in
`pipeline/src/terrainCatalogue.ts` and `pipeline/src/build-terrain-catalogue.ts`.
The API imports the shared types in `packages/atlas-runtime/src/maps/terrainCatalogue.ts` through its
existing type module. Terrain catalogue output stays at
`services/api/public/terrain-catalogue.json`; its bytes and content hash are
unchanged. The build graph runs the pipeline entry point and traces its imports
alongside the pipeline package and TypeScript configuration.

The operations compiler and entry point now live in
`pipeline/src/operationTemplates.ts` and `pipeline/src/build-operations.ts`.
The artifact types and OpenAPI document hash live in `packages/atlas-runtime/src/api/operations.ts`.
Request matching, query validation, and deprecation headers stay in the API.
The build still writes `services/api/public/operations.json` from
`services/api/openapi.yaml`, with identical bytes. Its cache inputs include the
OpenAPI document, compiler imports, and pipeline configuration.

The geometry source registry compiler and entry point now live in
`pipeline/src/geometrySourceRegistry.ts` and
`pipeline/src/build-geometry-source-registry.ts`. Its hashing
helper uses `@uk-data-atlas/artifacts`; the registry types live in
`packages/atlas-runtime/`, with API re-exports for existing consumers. Area
inventory artifact types also live in `packages/atlas-runtime/src/areas/areaInventory.ts`. The build
still writes byte-identical `services/api/public/geometry-sources.json` and
keeps the input hash cache at its existing path.

The area inventory compiler and entry point now live in
`pipeline/src/areaInventory.ts` and `pipeline/src/build-area-inventory.ts`.
The boundary registry and geography inventory builders move with it because
both inventory entry points call the boundary registry compiler directly.
The source inventory compiler also moves to `pipeline/src/sourceInventory.ts`.
The API keeps `createAreaLookup` and imports shared artifact contracts and
readers through its existing modules. The three stages keep their output paths
and bytes, including per-release area files and the geography build artifacts.
Their cache inputs include the pipeline configuration and moved imports.

The derived boundary builder now lives in
`pipeline/src/build-derived-boundaries.ts`. It uses the shared area source
adapter reader and source-path helper. The build graph runs this entry point
and includes the pipeline configuration in its cache inputs. Derived GeoJSON
stays under `services/api/public/boundaries/` with identical bytes. The builder
still removes the obsolete `derived-boundaries.json` manifest.

The geography catalogue finaliser now lives in
`pipeline/src/build-geography-catalogues.ts`. The build graph runs this entry
point and includes the pipeline configuration in its cache inputs. It stores
the same five catalogue payloads in `data/build/atlas.sqlite` and keeps the
existing temporary-copy, replacement, and public-file cleanup behavior.

The relationship candidate compiler and entry point now live in
`pipeline/src/relationshipCandidates.ts` and
`pipeline/src/build-relationship-candidates.ts`. Candidate artifact contracts,
the crosswalk adapter reader, and geography identifier validation live in
`packages/atlas-runtime/`, with API re-exports for existing consumers. The build graph traces
the moved compiler and pipeline configuration. The builder keeps the same
`services/api/public/relationship-candidates.json` bytes.

The relationship path compiler, approved-path reader, and build entry point
now live in `pipeline/src/relationshipPaths.ts`,
`pipeline/src/relationshipPathAdapters.ts`, and
`pipeline/src/build-relationship-paths.ts`. Path contracts and purpose lookup
live in `packages/atlas-runtime/src/relationships/relationshipPaths.ts`; the API keeps its runtime path index.
Compressed artifact access now uses `packages/artifacts/src/storedText.ts`, with API re-exports.
The graph traces the compiler and pipeline configuration. The builder preserves
`data/build/geography/relationship-paths.json` bytes and the existing discovery
step limit.

The analysis geography compiler and entry point now live in
`pipeline/src/analysisGeographies.ts` and
`pipeline/src/build-analysis-geographies.ts`. Analysis support contracts, data
catalogue contracts and measure geography identifiers live in
`packages/atlas-runtime/`, with API re-exports. Unit definitions live in
`@uk-data-atlas/catalogue/unit-registry`. The API keeps `analysisConversion` and
its observation and unit registry runtime functions. The build graph traces
the moved compiler and pipeline configuration. The builder preserves
`data/build/geography/analysis-geographies.json` bytes.

The atlas release compiler and entry point now live in
`pipeline/src/atlasRelease.ts` and `pipeline/src/build-atlas-release.ts`.
Release and map-resource contracts live in `packages/atlas-runtime/`, with API re-exports.
Both initial and final release stages run the moved entry point and include
the pipeline configuration in their cache inputs. Artifact selection, file
hashing, release identity, and the `services/api/public/atlas-release.json`
output path are unchanged.

The data catalogue entry point and dataset compilers now live in
`pipeline/src/build-data-catalog.ts` and `pipeline/src/catalog/`. Observation
table compilation and publication live in `pipeline/src/atlasObservationTables.ts`
and `pipeline/src/store-observations.ts`. Common observation contracts and
identity helpers, exact-byte SQLite observation readers, CSV parsing and country
classification live in `packages/atlas-runtime/`, with API re-exports for runtime
consumers. SQLite table writing lives in `@uk-data-atlas/artifacts`, and measure
slugging lives in `@uk-data-atlas/catalogue`. The graph traces these imports and the
pipeline configuration. Catalogue JSON and observation artifact bytes, SQLite
publication, cleanup, and output paths are unchanged.

The SQLite area inventory and release readers, and the lazy area lookup, live
in `packages/atlas-runtime/`. The API re-exports them for existing callers. These readers can
now be used by pipeline stages without importing the API boundary loader.

The named location SQLite inventory reader and its data contracts live in
`packages/atlas-runtime/`, with API re-exports. The reader still loads geometries lazily and
checks the inventory hash when it reads them.

The area search pipeline stage runs `pipeline/src/build-area-search-index.ts`
and uses DuckDB to build postings. The API cache rebuild uses the Node compiler
in `packages/atlas-runtime/`. Both publish the same SQLite tables and clean up legacy outputs.

The postcode counts compiler, cache publisher and SQLite postcode and area shard
readers live in `packages/atlas-runtime/`. Postcode types live in
`@uk-data-atlas/geography`, and code-unit ordering lives in
`@uk-data-atlas/search-index`.
The pipeline stage builds postcode counts with DuckDB; the API cache rebuild
uses the shared Node builder. Both use the shared cache publisher. The postcode
index SQLite table conversion and publisher also live in `packages/atlas-runtime/`.

The evidence documents stage now runs `pipeline/src/build-evidence-documents.ts`.
The evidence report compilers, catalogue and observation loaders, route
contracts, geography resolver, and their support modules live in `packages/atlas-runtime/`, with
API re-exports for the routes. The stage traces its own imports with esbuild
from the repository root. Document bytes, cache keys, and the
`services/api/public/evidence-documents.json` output path are unchanged.

Pipeline and shared code no longer spell out `services/api`. They ask
`packages/atlas-runtime/src/storage/dataLayout.ts` for the API project, its generated artifact directory,
its config directory and the release database, and
`tests/packages/packageImports.test.ts` rejects a hard-coded path. Moving the
artifact tree out of `services/api/public` is now a change to that file plus the
API's own readers and deployment.

That move is done. The generated artifacts, formerly `services/api/public`, now
live in `data/build/artifacts/` beside `atlas.sqlite`, so pipeline stages write
only under `data/build/` and `public/data/`. File names and bytes are
unchanged. Compose mounts the directory read-only, and the stage cache bumped
its version so old entries do not point at the removed path. Entries below that
name `services/api/public` describe the earlier layout.

The root `verify-*` and `place-postcodes` scripts import shared and pipeline
modules directly. Four verifiers (`verify-atlas-areas`, `-crosswalks`,
`-datasets` and `-locations`) still import `services/api/src/routes` and the API
route fixtures, because they check that the API's responses agree with the
release. A test allows only those two modules.

Two website-only steps left the data build graph. `seo` already ran in
`pnpm dev` and `pnpm build`, so `data:build` no longer repeats it. The README
source tables are documentation, not data, so `pnpm docs:sources` rewrites them
and `tests/docs/sourcesReadme.test.ts` fails when they drift. Both scripts
import the website's `lib/` and stay in `scripts/`; the pipeline never runs them.

The catalogue dataset compiler runs from `pipeline/src/compile-datasets.mts`,
with its cache, worker pool, raw-source readers and the fingerprint module in
`pipeline/src/precompile/`. The website stages still in `scripts/` import them
from there. Paths are part of every fingerprint, so this move recompiled each
dataset once; the compiled bytes were compared before and after. The fingerprint
no longer lists the README generator. The pipeline helpers
take their output directory explicitly. The website's `public/data/datasets`
path, and the `out`, `outputMatches` and `loadReuseContext` bindings to it, live
in `scripts/precompile/websiteOutput.mts`. The edited helpers are in every
dataset's import closure, so this changed the fingerprints once more.

This completes the terrain and operations catalogue groups in move-order step 2
and the geometry source registry and area inventory compilers in step 3. The inventory
above records the starting branch, not the current location of extracted files.
The remaining catalogue groups and steps 3 and 4 still need extraction.

## First PR validation

Builds run serially with a 3 GiB Node heap cap, one crosswalk worker and one
precompile job. Temporary command overrides apply those limits without changing
production defaults.

- `pnpm install` and `pnpm data:download` passed in this worktree.
- `pnpm data:build --only website-lookups` passed before and after the pure move.
  SHA-256 comparisons cover both manifests and every referenced gzip artifact,
  plus ordered `website_assets` ids, declared hashes and actual gzip bytes.
  All 694 files and 692 SQLite rows are identical.
- `pnpm --dir pipeline typecheck` passed.
- The four focused unit files passed all 36 tests with one worker and a
  30-second timeout. They cover asset routes, place readers, package boundaries
  and stage code invalidation. An earlier run hit a five-second timeout in an
  existing cache test under CPU contention; the serial rerun passed.

The shared-release path build also passed `pnpm data:build --only website-lookups`
after removing the former API-public page and lookup files. The same 694 files
and 692 SQLite rows are byte-identical at `data/build/atlas-assets/`.
The 49 focused website/build tests and 11 targeted API tests pass.
Full check results are recorded in the PR.

Bulk export compilation now lives in `pipeline/src/exportManifest.ts`, with
CSV and Parquet download generation in `pipeline/src/observationDownloads.ts`.
The graph runs `pipeline/src/build-export-manifest.ts` after `data-catalog`.
Manifest and download contracts live in `packages/atlas-runtime/`. The Parquet
writer lives in `@uk-data-atlas/artifacts`.
The API re-exports the manifest contracts and Parquet writer for runtime consumers.
The output paths, download formats, ordering, hashes, and publication behavior
remain unchanged.

Measure compatibility compilation runs in `pipeline/src/build-measure-compatibility.ts`
and `pipeline/src/measureCompatibility.ts`. The API and compiler share the
compatibility types and partition helpers in `packages/atlas-runtime/src/catalogue/measureCompatibility.ts`.
The API and builder read observations through `packages/atlas-runtime/src/catalogue/observationTables.ts`.

The lookup manifest build runs in `pipeline/src/build-lookup-manifest.ts`.
The API and builder share lookup table rendering and manifest types in
`packages/atlas-runtime/src/areas/lookupExports.ts`.

The cache publisher lives in `packages/atlas-runtime/src/storage/atlasCache.ts`. Place-name normalisation lives
in `@uk-data-atlas/geography`, and its index compatibility fingerprint is exported
by `@uk-data-atlas/search-index/node`.

The place index build runs in `pipeline/src/build-place-index.ts`. Its DuckDB
compiler deduplicates name postings, while place grouping, SQLite helpers and
boundary release ordering are shared with the API. The API cache rebuild uses
the shared Node builder.

The graph now runs geometry storage, map resources, crosswalks, named locations,
location projections, analysis geography validation, validation reports, and
SQLite assembly through pipeline entry points. Their shared builders and SQLite
writers remain available to the API where runtime cache construction needs them.

The postcode area, atlas page, atlas lookup, and API dataset builders also run
from `pipeline/src/`. Their resolver and coordinate helpers are shared with the
API. The boundary compiler lives in `pipeline/src/compile-boundaries.mts`; the
website fingerprint includes that compiler and its shared helpers.

Evidence document compilation still runs through the API catalogue and report
handlers. The website dataset compilation scripts also remain in `scripts/`.

The source acquisition tools for ONS boundary releases, lookups, the postcode
directory and ward history now live in `pipeline/src/sources/`. They write only
under `data/`, so their behaviour is unchanged. `fetch:onspd` and
`fetch:boundaries` are pipeline package scripts, and the API no longer has
`fetch:*` or `refresh:onspd` scripts.

The boundary tile compiler now lives in `pipeline/src/compile-boundary-tiles.mts`
and writes only `data/build/boundaries/`. Publishing those resources into
`public/data/boundaries` is a separate `website-tiles` stage that runs the
website's `scripts/link-boundary-tiles.ts`, which `website-datasets` now follows.
The `scripts/compile-boundaries.mts` re-export is gone; the graph runs the
pipeline entry points directly.

The catalogue registry generator now lives in
`pipeline/src/build-catalogue-registry.ts` and writes the committed index,
registry and type map under `packages/datasets`. The website's
`scripts/generate-dataset-registry.ts` keeps only the chart registry in
`lib/datasets`, reading the catalogue definitions through the pipeline module,
and no longer rewrites the catalogue files. Dataset discovery stays with the
website stages, which are its only users.
