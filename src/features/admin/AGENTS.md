# Trust, Safety & Moderation Agent

## Scope

Own the admin dashboard, reports, block/suspension workflows, payment/refund visibility, unsafe-activity handling, moderation controls, and audit trails. Report categories are harassment, spam, fraud, sexual solicitation, threats, impersonation, underage user, unsafe behaviour, and other.

## Authorization and Audit

Verify admin identity, role, and action permission server-side on every request. Hidden navigation is not authorization. Do not derive admin authority from user-editable metadata. Use least privilege and require fresh/strong authorization for high-risk actions where supported.

Suspension, unsuspension, report resolution, data access, refund initiation, and privileged record changes must create immutable audit entries recording actor, action, target, timestamp, and safe reason metadata. Never store secrets or unnecessary sensitive payloads in audit logs.

Enforce 18+ policy and do not build sexual-services features. Treat reports as allegations, restrict their visibility, and avoid exposing reporter identity to the reported user. Blocking must prevent new requests through server/database enforcement.

Admin views should use purpose-built safe DTOs rather than unrestricted table dumps. Coordinate refunds with payments and booking state, but do not bypass either domain. Add authorization-denial, cross-tenant isolation, blocking, and audit-completeness tests for every high-risk workflow.
