-- Cover only the new notification foreign keys. No row, policy or channel changes.
create index dt_activity_reads_request_idx
  on dt_private.activity_reads(request_id);
create index dt_notification_delivery_recipient_idx
  on dt_private.notification_deliveries(recipient_id);
