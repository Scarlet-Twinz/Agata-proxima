# GitHub Actions integration

Use GitHub Actions to run the Agata API smoke checks and your tenant-isolation acceptance tests. Copy `cli/agata.sh` into your repository or call the checked-in script. Configure `AGATA_API_BASE_URL` and `AGATA_API_KEY` as GitHub Actions environment secrets; never print them.

Example workflow (`.github/workflows/agata-smoke.yml`):

```yaml
name: Agata integration smoke
on:
  workflow_dispatch:
  push:
    branches: [main]
jobs:
  smoke:
    runs-on: ubuntu-latest
    environment: integration-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Verify required configuration
        env:
          AGATA_API_BASE_URL: ${{ secrets.AGATA_API_BASE_URL }}
          AGATA_API_KEY: ${{ secrets.AGATA_API_KEY }}
        run: |
          test -n "$AGATA_API_BASE_URL"
          test "${AGATA_API_KEY#aga_}" != "$AGATA_API_KEY"
      - name: Run smoke checks
        env:
          AGATA_API_BASE_URL: ${{ secrets.AGATA_API_BASE_URL }}
          AGATA_API_KEY: ${{ secrets.AGATA_API_KEY }}
        run: bash ./cli/agata.sh
```

Run against a non-production organization first. Add explicit allowed/denied cross-tenant tests for the customer's own protected data path; the basic smoke script alone does not prove tenant isolation.
