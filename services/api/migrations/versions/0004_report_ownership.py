"""Report ownership and a stricter audit trail.

- Withdrawing a report now needs the token handed to the reporter when it was
  created. Only its SHA-256 is stored: the token is 192 random bits, so a fast
  hash is enough and a leaked table gives nobody the power to withdraw.
  Reports made before this migration have no token and can only be changed by
  a moderator.
- report_events could already not be updated or deleted row by row; TRUNCATE,
  which skips row triggers, is now refused too.
- reports.status can only change through transition_report(), which audits the
  change. The function marks the transaction with the report it is moving, and
  a trigger refuses any other status change.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE reports ADD COLUMN withdraw_token_hash bytea;

        CREATE TRIGGER report_events_no_truncate
            BEFORE TRUNCATE ON report_events
            FOR EACH STATEMENT EXECUTE FUNCTION forbid_change();

        CREATE FUNCTION guard_report_status() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.status IS DISTINCT FROM OLD.status
               AND current_setting('pathable.transition', true) IS DISTINCT FROM OLD.id::text THEN
                RAISE EXCEPTION 'report status changes only through transition_report()'
                    USING ERRCODE = 'insufficient_privilege';
            END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER reports_status_guard
            BEFORE UPDATE OF status ON reports
            FOR EACH ROW EXECUTE FUNCTION guard_report_status();

        CREATE OR REPLACE FUNCTION transition_report(p_id uuid, p_to text, p_actor text) RETURNS reports
        LANGUAGE plpgsql AS $$
        DECLARE r reports;
        BEGIN
            SELECT * INTO r FROM reports WHERE id = p_id FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'report not found' USING ERRCODE = 'no_data_found'; END IF;
            IF NOT EXISTS (SELECT 1 FROM report_transitions WHERE from_status = r.status AND to_status = p_to) THEN
                RAISE EXCEPTION 'transition % -> % not allowed', r.status, p_to USING ERRCODE = 'check_violation';
            END IF;
            INSERT INTO report_events (report_id, from_status, to_status, actor) VALUES (p_id, r.status, p_to, p_actor);
            -- Lets reports_status_guard through for this report, for the rest of this transaction only.
            PERFORM set_config('pathable.transition', p_id::text, true);
            UPDATE reports SET status = p_to WHERE id = p_id RETURNING * INTO r;
            PERFORM set_config('pathable.transition', '', true);
            RETURN r;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS reports_status_guard ON reports;
        DROP FUNCTION IF EXISTS guard_report_status;
        DROP TRIGGER IF EXISTS report_events_no_truncate ON report_events;
        ALTER TABLE reports DROP COLUMN IF EXISTS withdraw_token_hash;
        """
    )
