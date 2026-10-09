\set ON_ERROR_STOP on

\if :{?target_email}
\else
  \echo ERROR: pass -v target_email=your-exact-login-email
  \quit 2
\endif

\echo
\echo ===== DRY RUN: account cleanup preview =====
SELECT id AS target_user_id, email, email_verified_at, created_at
FROM users
WHERE lower(email) = lower(trim(:'target_email'));

SELECT o.id AS organization_id, o.name, o.slug, m.role,
       (SELECT count(*) FROM memberships members WHERE members.organization_id = o.id) AS member_count,
       (SELECT count(*) FROM billing_accounts b
        WHERE b.organization_id = o.id AND b.status NOT IN ('inactive','canceled')) AS active_billing_count
FROM organizations o
JOIN memberships m ON m.organization_id = o.id
JOIN users u ON u.id = m.user_id
WHERE lower(u.email) = lower(trim(:'target_email'))
ORDER BY o.created_at;

\if :{?confirm_email}
  SELECT lower(trim(:'confirm_email')) = lower(trim(:'target_email')) AS confirmation_matches \gset
  \if :confirmation_matches
    \echo
    \echo ===== CONFIRMED CLEANUP: safeguards will run before any deletion =====
    BEGIN;
    CREATE TEMP TABLE _agata_cleanup_target_user ON COMMIT DROP AS
      SELECT id, email FROM users WHERE lower(email) = lower(trim(:'target_email'));

    DO $guard$
    DECLARE
      target_count integer;
    BEGIN
      SELECT count(*) INTO target_count FROM _agata_cleanup_target_user;
      IF target_count <> 1 THEN
        RAISE EXCEPTION 'Cleanup stopped: expected exactly one account matching target_email, found %.', target_count;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM memberships mine
        JOIN _agata_cleanup_target_user target ON target.id = mine.user_id
        JOIN memberships other_member
          ON other_member.organization_id = mine.organization_id
         AND other_member.user_id <> mine.user_id
      ) THEN
        RAISE EXCEPTION 'Cleanup stopped: at least one organization has other members. No data was deleted.';
      END IF;

      IF EXISTS (
        SELECT 1 FROM memberships mine
        JOIN _agata_cleanup_target_user target ON target.id = mine.user_id
        WHERE mine.role <> 'owner'
      ) THEN
        RAISE EXCEPTION 'Cleanup stopped: the target account is not owner of every organization it belongs to. No data was deleted.';
      END IF;

      IF EXISTS (
        SELECT 1 FROM memberships mine
        JOIN _agata_cleanup_target_user target ON target.id = mine.user_id
        JOIN billing_accounts b ON b.organization_id = mine.organization_id
        WHERE b.status NOT IN ('inactive','canceled')
      ) THEN
        RAISE EXCEPTION 'Cleanup stopped: at least one organization has active billing. No data was deleted.';
      END IF;
    END
    $guard$;

    DELETE FROM organizations o
    WHERE o.id IN (
      SELECT m.organization_id
      FROM memberships m
      JOIN _agata_cleanup_target_user target ON target.id = m.user_id
    );

    DELETE FROM users u
    USING _agata_cleanup_target_user target
    WHERE u.id = target.id;

    COMMIT;
    \echo Cleanup completed for the exact target email. No unrelated accounts were selected.
  \else
    \echo ERROR: confirm_email does not exactly match target_email. Nothing was deleted.
    \quit 2
  \endif
\else
  \echo DRY RUN ONLY. No rows were deleted.
  \echo To execute, pass BOTH -v target_email=your-exact-login-email and -v confirm_email=the-same-exact-login-email.
\endif
