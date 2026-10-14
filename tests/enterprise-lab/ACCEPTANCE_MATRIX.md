# Northstar Service Desk — Enterprise Acceptance Matrix

This is the execution checklist for `tests/enterprise-lab/README.md`. It records test intent only; all statuses begin NOT RUN. Do not change a status without recorded evidence.

| ID | Scenario | Expected result | Severity if failed | Initial status |
|---|---|---|---|---|
| A-01 | Clean-clone installation | Documented setup works without hidden local state | High | NOT RUN |
| A-02 | Required configuration missing | Clear startup failure; no unsafe default | High | NOT RUN |
| B-01 | Tenant A reads own tickets | Only A rows returned | High | NOT RUN |
| B-02 | Tenant B reads own tickets | Only B rows returned | High | NOT RUN |
| B-03 | Tenant C reads own tickets | Only C rows returned | High | NOT RUN |
| B-04 | Prepared statements and transactions | Correct tenant context maintained | Critical | NOT RUN |
| B-05 | Connection reuse across tenants | No identity/session contamination | Critical | NOT RUN |
| C-01 | A reads B/C rows | No unauthorized rows disclosed | Critical / release blocker | NOT RUN |
| C-02 | B reads A/C rows | No unauthorized rows disclosed | Critical / release blocker | NOT RUN |
| C-03 | C reads A/B rows | No unauthorized rows disclosed | Critical / release blocker | NOT RUN |
| C-04 | Cross-tenant INSERT/UPDATE/DELETE | No unauthorized row mutation | Critical / release blocker | NOT RUN |
| C-05 | Invalid/tampered/expired token | Rejected according to real token contract | Critical | NOT RUN |
| C-06 | Session/role/RLS bypass attempts | Tenant cannot escape boundary | Critical / release blocker | NOT RUN |
| C-07 | Direct database bypass attempt | Application client cannot bypass Engine | Critical / release blocker | NOT RUN |
| C-08 | PostgreSQL role audit | No tenant role has unintended superuser/BYPASSRLS/table-owner power | Critical | NOT RUN |
| D-01 | Malformed or oversized frames | Controlled rejection, no crash | High | NOT RUN |
| D-02 | Concurrent three-tenant traffic | Correct results and bounded resources | High | NOT RUN |
| D-03 | Disconnects and stalled upstream | Cleanup and timeout work safely | High | NOT RUN |
| E-01 | Required TLS / invalid CA / hostname | Required verification succeeds/fails correctly | Critical | NOT RUN |
| E-02 | Credential rotation | New credential works; revoked credential rejected as specified | Critical | NOT RUN |
| F-01 | PostgreSQL outage/recovery | No stale tenant session or authorization bypass | Critical | NOT RUN |
| F-02 | Engine restart | Safe reconnection; tenant isolation preserved | Critical | NOT RUN |
| F-03 | Control Plane outage/recovery | Engine enforcement remains local as documented | High | NOT RUN |
| F-04 | Invalid policy publication | Invalid policy not activated | Critical | NOT RUN |
| G-01 | Health/readiness accuracy | Status reflects actual dependency state | High | NOT RUN |
| G-02 | Metrics scrape | Only if endpoint is implemented; values match test traffic | Medium | NOT RUN |
| G-03 | Audit event accuracy and redaction | Events match decisions and contain no secrets | High | NOT RUN |
| G-04 | Attest signature verification/tamper test | Only if Attest exists; independent verification detects tampering | Critical | NOT RUN |
| H-01 | Organization/tenant authorization | Cross-organization API requests denied | Critical | NOT RUN |
| H-02 | Node and policy lifecycle | Supported management workflows match Engine behavior | High | NOT RUN |
| H-03 | Tenant offboarding | Credentials/access revoked; deletion/export follows policy | High | NOT RUN |
| I-01 | Repeatable performance baseline | Raw measurements and environment metadata saved | Medium | NOT RUN |
| J-01 | Fresh staging deployment | Clean migrations and real services work | High | NOT RUN |
| J-02 | Backup and isolated restore | Restore verified, not just backup creation | High | NOT RUN |
| J-03 | Monitoring alert delivery | Test alert reaches monitored destination | High | NOT RUN |
| J-04 | Rollback and final go/no-go | Recovery evidence and explicit decision recorded | Critical | NOT RUN |

## Result record template

Copy for each run:

- Run ID:
- Scenario ID(s):
- Branch / commit SHA:
- Environment (local/staging/production):
- Date/time and timezone:
- Exact command(s):
- Expected result:
- Observed result:
- Status: PASS / FAIL / BLOCKED / NOT RUN
- Exit code:
- Sanitized evidence path:
- Defect/issue:
- Retest commit:
- Reviewer:

## Status policy

- **PASS:** expected behavior observed against the real component and evidence saved.
- **FAIL:** behavior differs from expectation.
- **BLOCKED:** required environment, capability, credential or decision is unavailable; include exact blocker.
- **NOT RUN:** no execution evidence exists.

No item is PASS merely because code, a test file, a dashboard card or a CI workflow exists. A lab run does not itself confer production acceptance.