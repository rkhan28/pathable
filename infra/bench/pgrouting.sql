-- pgRouting candidate for the engine benchmark (docs/decisions/0002).
-- The knowledge-state rule from services/api/pathable_api/scoring.py, written in
-- PL/pgSQL so pgRouting can price edges per request from the stored evidence.
-- Hazards are left out here; the benchmark compares path finding, not reports.

CREATE EXTENSION IF NOT EXISTS pgrouting;

CREATE OR REPLACE FUNCTION pa_three_way(v double precision, threshold double precision, margin double precision, higher_is_better boolean)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v IS NULL THEN 'unknown'
    WHEN (CASE WHEN higher_is_better THEN v - threshold ELSE threshold - v END) > margin THEN 'pass'
    WHEN (CASE WHEN higher_is_better THEN v - threshold ELSE threshold - v END) < -margin THEN 'fail'
    ELSE 'unknown' END
$$;

CREATE OR REPLACE FUNCTION pa_check(e jsonb, p jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  attr text := e->>'attribute';
  val jsonb := e->'value';
  margin double precision := coalesce((e->>'error')::double precision, 0);
  ends text[];
  a text; b text;
BEGIN
  IF attr = 'presence' THEN
    RETURN CASE WHEN jsonb_typeof(val) = 'null' OR val IS NULL THEN 'unknown' WHEN val = 'true'::jsonb THEN 'pass' ELSE 'fail' END;
  ELSIF attr = 'steps' THEN
    RETURN CASE WHEN val = 'true'::jsonb AND (p->>'avoidStairs')::boolean THEN 'fail' ELSE 'pass' END;
  ELSIF attr = 'surface' THEN
    IF jsonb_typeof(val) <> 'string' THEN RETURN 'unknown'; END IF;
    IF val #>> '{}' IN ('asphalt','concrete','concrete:plates','concrete:lanes','paving_stones','paved','tartan','rubber') THEN RETURN 'pass'; END IF;
    IF val #>> '{}' IN ('gravel','fine_gravel','dirt','ground','grass','sand','mud','earth','unpaved','compacted','pebblestone',
                        'woodchips','sett','cobblestone','unhewn_cobblestone','grass_paver','rock') THEN
      RETURN CASE WHEN (p->>'avoidDamagedSurfaces')::boolean THEN 'fail' ELSE 'pass' END;
    END IF;
    RETURN 'unknown';
  ELSIF attr = 'width' THEN
    IF NOT (p->>'avoidNarrow')::boolean THEN RETURN NULL; END IF;
    RETURN pa_three_way(CASE WHEN jsonb_typeof(val) = 'number' THEN (val #>> '{}')::double precision END,
                        (p->>'minWidthM')::double precision, margin, true);
  ELSIF attr = 'running_slope' THEN
    IF e->'corroboration' IS NULL THEN RETURN 'unknown'; END IF;
    a := pa_three_way(CASE WHEN jsonb_typeof(val) = 'number' THEN (val #>> '{}')::double precision END,
                      (p->>'maxRunningSlopePct')::double precision, margin, false);
    b := pa_three_way((e->'corroboration'->>'value')::double precision, (p->>'maxRunningSlopePct')::double precision, margin, false);
    RETURN CASE WHEN a = b THEN a ELSE 'unknown' END;
  ELSIF attr = 'kerbs' THEN
    IF NOT (p->>'avoidMissingRamps')::boolean THEN RETURN NULL; END IF;
    IF jsonb_typeof(val) <> 'string' THEN RETURN 'unknown'; END IF;
    ends := string_to_array(val #>> '{}', ';');
    IF 'raised' = ANY(ends) THEN RETURN 'fail'; END IF;
    RETURN CASE WHEN array_length(ends, 1) = 2 AND ends <@ ARRAY['lowered','flush','no'] THEN 'pass' ELSE 'unknown' END;
  END IF;
  RETURN NULL;  -- aps is informational
END $$;

CREATE OR REPLACE FUNCTION pa_state(evidence jsonb, p jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH c AS (SELECT pa_check(e, p) AS v FROM jsonb_array_elements(evidence) e)
  SELECT CASE
    WHEN bool_or(v = 'fail') THEN 'barrier'
    WHEN count(v) > 0 AND bool_and(v = 'pass') FILTER (WHERE v IS NOT NULL) THEN 'verified'
    ELSE 'unknown' END
  FROM c
$$;

CREATE OR REPLACE FUNCTION pa_weight(evidence jsonb, p jsonb) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s
    WHEN 'verified' THEN 1.0
    WHEN 'barrier' THEN CASE WHEN (p->>'preferShorter')::boolean THEN 3.5 ELSE 6.0 END
    ELSE CASE WHEN (p->>'preferVerified')::boolean
              THEN CASE WHEN (p->>'preferShorter')::boolean THEN 1.3 ELSE 1.6 END
              ELSE CASE WHEN (p->>'preferShorter')::boolean THEN 1.125 ELSE 1.25 END END
  END FROM (SELECT pa_state(evidence, p) AS s) x
$$;

-- Noded network: one row per consecutive coordinate pair, like the in-process router.
DROP TABLE IF EXISTS bench_edges;
CREATE TABLE bench_edges AS
WITH pts AS (
  SELECT e.id AS piece_id, (dp).path[1] AS i, (dp).geom AS g
  FROM edges e, ST_DumpPoints(e.geom) dp
), segs AS (
  SELECT piece_id, g AS a, lead(g) OVER (PARTITION BY piece_id ORDER BY i) AS b FROM pts
)
SELECT row_number() OVER () AS id, piece_id,
       round(ST_X(a)::numeric, 7)::text || ',' || round(ST_Y(a)::numeric, 7)::text AS ka,
       round(ST_X(b)::numeric, 7)::text || ',' || round(ST_Y(b)::numeric, 7)::text AS kb,
       ST_Length(ST_MakeLine(a, b)::geography) AS length_m, a, b
FROM segs WHERE b IS NOT NULL AND NOT ST_Equals(a, b);

DROP TABLE IF EXISTS bench_vertices;
CREATE TABLE bench_vertices AS
SELECT row_number() OVER () AS id, k, geom FROM (
  SELECT ka AS k, a AS geom FROM bench_edges UNION SELECT kb, b FROM bench_edges
) v;
CREATE UNIQUE INDEX ON bench_vertices (k);
CREATE INDEX ON bench_vertices USING gist (geom);

ALTER TABLE bench_edges ADD COLUMN source bigint, ADD COLUMN target bigint;
UPDATE bench_edges e SET source = v.id FROM bench_vertices v WHERE v.k = e.ka;
UPDATE bench_edges e SET target = v.id FROM bench_vertices v WHERE v.k = e.kb;
CREATE INDEX ON bench_edges (piece_id);
ANALYZE bench_edges;
