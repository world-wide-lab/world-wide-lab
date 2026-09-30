<p align="center">
  <img alt="The World-Wide-Lab Logo" src="../server/static/logo-server.svg" width="60%">
</p>

# World-Wide-Lab: Server

The World-Wide-Lab server application containing the core of this software. You can run this on the cloud or on your own server-infrastructure to conduct (large-scale) online research.

## Running Tests

```bash
# Unit tests, against an in-memory SQLite database
npm test

# The same tests against postgres. Every test file creates (and afterwards
# drops) its own "wwl_test_*" database, so the user needs CREATEDB permissions.
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npm test
```
