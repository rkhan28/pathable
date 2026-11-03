"""Initial schema: evidence edges, hazards, reports with an append-only audit log.

Revision ID: 0001
"""

from alembic import op

revision = "0001"
down_revision = None

KINDS = "'obstacle','surface_damage','construction','missing_ramp','blocked_ramp','snow','ice','steep_change'"


def upgrade() -> None:
    op.execute(
        f"""
        CREATE EXTENSION IF NOT EXISTS postgis;

        CREATE TABLE data_versions (
            id          text PRIMARY KEY,
            built_at    timestamptz NOT NULL DEFAULT now(),
            coverage    geometry(MultiPolygon, 4326) NOT NULL,
            notes       text NOT NULL DEFAULT ''
        );

        -- One row per graph edge (an OSM way cut into pieces of at most 50 m).
        -- evidence is the contract's Evidence[]: value, source, date, error per attribute.
        CREATE TABLE edges (
            id            text PRIMARY KEY,
            data_version  text NOT NULL REFERENCES data_versions(id) ON DELETE CASCADE,
            osm_way       bigint,
            kind          text NOT NULL CHECK (kind IN ('sidewalk','crossing','path','steps','road_edge')),
            street        text,
            length_m      double precision NOT NULL CHECK (length_m >= 0),
            evidence      jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'array'),
            geom          geometry(LineString, 4326) NOT NULL
        );
        CREATE INDEX edges_geom_idx ON edges USING gist (geom);
        CREATE INDEX edges_version_idx ON edges (data_version);

        -- Measured hazards from the pipeline (e.g. steep changes in ground level).
        CREATE TABLE hazards (
            id           text PRIMARY KEY,
            kind         text NOT NULL CHECK (kind IN ({KINDS})),
            status       text NOT NULL CHECK (status IN ('verified','reported')),
            source       text NOT NULL,
            observed_on  date NOT NULL,
            expires_at   timestamptz,
            edge_id      text REFERENCES edges(id) ON DELETE CASCADE,
            geom         geometry(Point, 4326) NOT NULL
        );
        CREATE INDEX hazards_geom_idx ON hazards USING gist (geom);

        CREATE TABLE reports (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            kind         text NOT NULL CHECK (kind IN ({KINDS})),
            description  text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
            photo_id     text,
            observed_on  date NOT NULL CHECK (observed_on <= current_date),
            status       text NOT NULL DEFAULT 'received'
                         CHECK (status IN ('received','under_review','verified','rejected','withdrawn')),
            received_at  timestamptz NOT NULL DEFAULT now(),
            -- Winter conditions change daily: snow, ice and blocked ramps expire after 48 hours.
            expires_at   timestamptz,
            geom         geometry(Point, 4326) NOT NULL
        );
        CREATE INDEX reports_geom_idx ON reports USING gist (geom);

        CREATE TABLE report_transitions (
            from_status text NOT NULL,
            to_status   text NOT NULL,
            PRIMARY KEY (from_status, to_status)
        );
        INSERT INTO report_transitions VALUES
            ('received','under_review'), ('received','withdrawn'),
            ('under_review','verified'), ('under_review','rejected'), ('under_review','withdrawn'),
            ('verified','withdrawn');

        -- Append-only audit of every status a report has had.
        CREATE TABLE report_events (
            id          bigserial PRIMARY KEY,
            report_id   uuid NOT NULL REFERENCES reports(id),
            from_status text,
            to_status   text NOT NULL,
            actor       text NOT NULL,
            at          timestamptz NOT NULL DEFAULT now()
        );
        CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'report_events is append-only';
        END $$;
        CREATE TRIGGER report_events_append_only
            BEFORE UPDATE OR DELETE ON report_events
            FOR EACH ROW EXECUTE FUNCTION forbid_change();

        -- The only way to change a report's status: checks the transition and audits it atomically.
        CREATE FUNCTION transition_report(p_id uuid, p_to text, p_actor text) RETURNS reports
        LANGUAGE plpgsql AS $$
        DECLARE r reports;
        BEGIN
            SELECT * INTO r FROM reports WHERE id = p_id FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'report not found' USING ERRCODE = 'no_data_found'; END IF;
            IF NOT EXISTS (SELECT 1 FROM report_transitions WHERE from_status = r.status AND to_status = p_to) THEN
                RAISE EXCEPTION 'transition % -> % not allowed', r.status, p_to USING ERRCODE = 'check_violation';
            END IF;
            INSERT INTO report_events (report_id, from_status, to_status, actor) VALUES (p_id, r.status, p_to, p_actor);
            UPDATE reports SET status = p_to WHERE id = p_id RETURNING * INTO r;
            RETURN r;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP FUNCTION IF EXISTS transition_report;
        DROP TABLE IF EXISTS report_events, report_transitions, reports, hazards, edges, data_versions;
        DROP FUNCTION IF EXISTS forbid_change;
        """
    )
