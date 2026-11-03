"""Transit schedule (TTC GTFS) for accessible bus, streetcar, LRT and subway options.

Only the stops in and around the pilot area are loaded, with every trip that
serves them. Times are seconds after the service day's midnight, as in GTFS
(they can exceed 24:00 for trips that run past midnight).

Revision ID: 0003
Revises: 0002
"""

from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE transit_feed (
            id            text PRIMARY KEY,
            publisher     text NOT NULL,
            valid_from    date NOT NULL,
            valid_to      date NOT NULL,
            loaded_at     timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE transit_stops (
            stop_id              text PRIMARY KEY,
            name                 text NOT NULL,
            geom                 geometry(Point, 4326) NOT NULL,
            -- GTFS: 0 unknown, 1 accessible, 2 not accessible
            wheelchair_boarding  smallint NOT NULL DEFAULT 0
        );
        CREATE INDEX transit_stops_geog_idx ON transit_stops USING gist ((geom::geography));

        CREATE TABLE transit_routes (
            route_id    text PRIMARY KEY,
            short_name  text NOT NULL,
            long_name   text NOT NULL,
            route_type  smallint NOT NULL,
            color       text
        );

        CREATE TABLE transit_trips (
            trip_id               text PRIMARY KEY,
            route_id              text NOT NULL REFERENCES transit_routes(route_id),
            service_id            text NOT NULL,
            headsign              text NOT NULL DEFAULT '',
            wheelchair_accessible smallint NOT NULL DEFAULT 0,
            shape_id              text
        );
        CREATE INDEX transit_trips_service_idx ON transit_trips (service_id);

        CREATE TABLE transit_stop_times (
            trip_id        text NOT NULL,
            stop_sequence  integer NOT NULL,
            stop_id        text NOT NULL,
            arrival_s      integer NOT NULL,
            departure_s    integer NOT NULL,
            shape_dist     double precision,  -- metres along the trip's shape
            PRIMARY KEY (trip_id, stop_sequence)
        );

        -- The path each vehicle follows, so a ride is drawn where it really goes,
        -- including stretches outside the pilot area.
        CREATE TABLE transit_shapes (
            shape_id  text PRIMARY KEY,
            geom      geometry(LineString, 4326) NOT NULL,
            length    double precision NOT NULL  -- shape_dist_traveled at the last point
        );
        CREATE INDEX transit_stop_times_board_idx ON transit_stop_times (stop_id, departure_s);

        CREATE TABLE transit_calendar (
            service_id  text PRIMARY KEY,
            days        boolean[] NOT NULL,  -- Monday first
            start_date  date NOT NULL,
            end_date    date NOT NULL
        );
        CREATE TABLE transit_calendar_dates (
            service_id      text NOT NULL,
            date            date NOT NULL,
            exception_type  smallint NOT NULL,  -- 1 added, 2 removed
            PRIMARY KEY (service_id, date)
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS transit_shapes, transit_calendar_dates, transit_calendar, transit_stop_times,
            transit_trips, transit_routes, transit_stops, transit_feed;
        """
    )
