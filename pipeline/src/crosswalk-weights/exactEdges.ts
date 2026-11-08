/**
 * Which edges regroup exactly, so need no stored weight: every basis weighs
 * them 1, and `v_crosswalk_weight` says so rather than the file holding a row
 * for each. An edge is exact when its source lies wholly in its target:
 *
 * - the crosswalk is identity (`extent-continuity`: same area, same extent) or
 *   containment (`clean-containment`, `geometric-containment`);
 * - the crosswalk is a publisher lookup of membership, such as data zones in
 *   local authorities;
 * - the publisher marks the code unchanged (`change = 'unchanged'`);
 * - best fit found the child within its parent (`relation = 'within'`).
 *
 * Any other edge (a split or merged code, a straddling child, an overlap) is
 * weighted from the held counts, or has no weight where none can be.
 *
 * SQL over `c` (crosswalk) and `e` (crosswalk_edge). `IS` keeps a null `change`
 * or `relation` from making the whole test null.
 */
export const EXACT_EDGE_SQL = `(c.method IN ('extent-continuity', 'clean-containment', 'geometric-containment') OR (c.method = 'official-lookup' AND c.purpose IS 'membership') OR e.change IS 'unchanged' OR e.relation IS 'within')`;

/**
 * A source of a `postcode-overlap` crosswalk with exactly one target weighs 1
 * on every basis, so its edge needs no extra-basis rows either:
 * `v_crosswalk_weight` says so with `derivation = 'single-target'`, and there
 * is no `overlap` or `source_share` for it (the pruned pairs left under 1% of
 * the source elsewhere). The crosswalk's own basis rows stay. It is not done
 * for other methods, whose single edges can be a straddling child's best fit,
 * whose `source_share` is what says so.
 *
 * SQL over `c` (crosswalk) and `e` (crosswalk_edge).
 */
export const SINGLE_TARGET_SQL = `(c.method = 'postcode-overlap' AND NOT EXISTS (SELECT 1 FROM crosswalk_edge o WHERE o.crosswalk_id = e.crosswalk_id AND o.from_version_id = e.from_version_id AND o.to_version_id <> e.to_version_id))`;
