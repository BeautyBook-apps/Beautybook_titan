-- Allow each authenticated user to permanently remove their own notifications.
-- The ownership migration intentionally kept SELECT/UPDATE only, which made
-- the UI look correct until refresh because DELETE was rejected by RLS.
DO $$
BEGIN
  IF to_regclass('public."Notification"') IS NOT NULL THEN
    GRANT DELETE ON public."Notification" TO authenticated;
    DROP POLICY IF EXISTS bb_delete_own_notification ON public."Notification";
    CREATE POLICY bb_delete_own_notification
      ON public."Notification"
      FOR DELETE
      TO authenticated
      USING (user_email = auth.jwt()->>'email');
  END IF;
END $$;
