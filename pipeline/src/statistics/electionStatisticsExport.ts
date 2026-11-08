/** SQL for catalogue election measures calculated from canonical vote rows. */
export function electionStatisticsExport(
	measure: string,
): { sql: string; party: boolean } | undefined {
	const turnout = measure === "general-election-turnout";
	const total = measure === "local-election-effective-votes";
	const match = total
		? null
		: /^(general|local)-election-([a-z]+)-(votes|vote-share)$/.exec(
				measure,
			);
	if (!match && !turnout && !total) return undefined;
	if (match?.[1] === "local" && match[3] !== "votes") return undefined;
	const party = match?.[2];
	if (match?.[1] === "local" || total) {
		const value = party
			? `CASE WHEN count(CASE WHEN dm.code = '${party}' THEN 1 END) = 0 THEN 0 ELSE sum(CASE WHEN dm.code = '${party}' THEN o.value END) END`
			: "sum(o.value)";
		const status = party
			? `coalesce(max(CASE WHEN dm.code = '${party}' THEN st.slug END), 'observed')`
			: "min(st.slug)";
		return {
			party: Boolean(party),
			sql: `SELECT d.slug, ?, 'votes', r.geography, r.release, a.code, p.label,
			${value}, NULL, NULL, NULL, ${status}${party ? `, '${party}'` : ""}
			FROM dataset d JOIN series s ON s.dataset_id=d.id JOIN measure m ON m.id=s.measure_id
			JOIN series_member sm ON sm.series_id=s.id JOIN dimension dim ON dim.id=sm.dimension_id AND dim.slug='party'
			JOIN dimension_member dm ON dm.id=sm.member_id JOIN observation o ON o.series_id=s.id
			JOIN area_version av ON av.id=o.area_version_id JOIN area a ON a.id=av.area_id
			JOIN area_releases r ON r.id=s.release_id JOIN period p ON p.id=o.period_id JOIN status st ON st.id=o.status_id
			WHERE d.slug='local-election' AND m.slug='party-votes'
			GROUP BY d.slug,r.geography,r.release,a.code,p.label ORDER BY r.geography,r.release,p.label,a.code`,
		};
	}
	const partyJoin = party
		? `LEFT JOIN series ps ON ps.dataset_id=s.dataset_id AND ps.release_id=s.release_id
		AND ps.measure_id=(SELECT id FROM measure WHERE slug='party-votes') AND EXISTS (
			SELECT 1 FROM series_member sm JOIN dimension di ON di.id=sm.dimension_id JOIN dimension_member dm ON dm.id=sm.member_id
			WHERE sm.series_id=ps.id AND di.slug='party' AND dm.code='${party}')
		LEFT JOIN observation po ON po.series_id=ps.id AND po.area_version_id=o.area_version_id AND po.period_id=o.period_id
		LEFT JOIN status pst ON pst.id=po.status_id`
		: "";
	const turnoutJoins = turnout
		? `LEFT JOIN series es ON es.dataset_id=s.dataset_id AND es.release_id=s.release_id AND es.measure_id=(SELECT id FROM measure WHERE slug='electorate')
		LEFT JOIN observation eo ON eo.series_id=es.id AND eo.area_version_id=o.area_version_id AND eo.period_id=o.period_id
		LEFT JOIN series ins ON ins.dataset_id=s.dataset_id AND ins.release_id=s.release_id AND ins.measure_id=(SELECT id FROM measure WHERE slug='rejected-ballots')
		LEFT JOIN observation ino ON ino.series_id=ins.id AND ino.area_version_id=o.area_version_id AND ino.period_id=o.period_id`
		: "";
	const votes = "CASE WHEN po.series_id IS NULL THEN 0 ELSE po.value END";
	const value = turnout
		? "CASE WHEN eo.value=0 THEN 0 ELSE 100.0*(o.value+ino.value)/eo.value END"
		: match?.[3] === "vote-share"
			? `100.0*(${votes})/nullif(o.value,0)`
			: votes;
	return {
		party: Boolean(party),
		sql: `SELECT d.slug, ?, '${turnout || match?.[3] === "vote-share" ? "percent" : "votes"}', r.geography, r.release, a.code, p.label,
		${value}, NULL, NULL, NULL, ${party ? "coalesce(pst.slug, st.slug)" : "st.slug"}${party ? `, '${party}'` : ""}
		FROM dataset d JOIN series s ON s.dataset_id=d.id JOIN measure m ON m.id=s.measure_id
		JOIN observation o ON o.series_id=s.id JOIN area_version av ON av.id=o.area_version_id JOIN area a ON a.id=av.area_id
		JOIN area_releases r ON r.id=s.release_id JOIN period p ON p.id=o.period_id JOIN status st ON st.id=o.status_id
		${partyJoin} ${turnoutJoins}
		WHERE d.slug='general-election' AND m.slug='valid-votes' ORDER BY r.geography,r.release,p.label,a.code`,
	};
}
