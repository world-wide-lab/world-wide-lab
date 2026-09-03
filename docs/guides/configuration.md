# Configuring The World-Wide-Lab Server

_Coming soon..._

## List of Environment Variables

| Variable                                                         | Description                                                                                                                                                                                                                                                          | Default                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ADMIN_UI`                                                       | Should the administration interface at `/admin` be enabled?                                                                                                                                                                                                          | `true`                    |
| `API_DOCS`                                                       | Should documentation for the API be made available by the server at `/api-docs`?                                                                                                                                                                                     | `true`                    |
| `DATABASE_URL` (**required**)                                    | The URL pointing to the database, including credentials.                                                                                                                                                                                                             | _No Default_              |
| `ADMIN_AUTH_SESSION_SECRET` (_required if `ADMIN_UI` is true_)   | A random, secret piece of information used to secure authentication sessions. Required and should be random characters.                                                                                                                                              | _No Default_              |
| `ADMIN_AUTH_DEFAULT_EMAIL` (_required if `ADMIN_UI` is true_)    | The default email to use to login to the Admin UI. Use something secure and non-obvious here.                                                                                                                                                                        | _No Default_              |
| `ADMIN_AUTH_DEFAULT_PASSWORD` (_required if `ADMIN_UI` is true_) | The default password to use to login to the Admin UI. Use something secure and non-obvious here.                                                                                                                                                                     | _No Default_              |
| `DEFAULT_API_KEY`                                                | The token to use to authenticate with the World-Wide-Lab API for use with protected endpoints to e.g. download data. If not provided, these endpoints will be unavailable. This is not needed for standard usage, such as adding responses / data to World-Wide-Lab. | _No Default_              |
| `WWL_ENV_FILE`                                                   | Which file to load environment variables from (additionally to the ones set in the actual environment)                                                                                                                                                               | `".env"`                  |
| `ROOT`                                                           | The root URL where World-Wide-Lab is running.                                                                                                                                                                                                                        | `"http://localhost"`      |
| `PORT`                                                           | The port at which World-Wide-Lab is running                                                                                                                                                                                                                          | `8787`                    |
| `LOGGING_DIR`                                                    | Which directory to write logs to.                                                                                                                                                                                                                                    | `"logs"`                  |
| `LOGGING_LEVEL_CONSOLE`                                          | At which level default logs should be written. From coarse to detailed, the available levels are: `error`, `warn`, `info`, `http`, `sql`, `verbose`, `debug`, `silly`. Typically info or verbose are reccommended.                                                   | `"info"`                  |
| `LOGGING_HTTP`                                                   | Should HTTP calls be logged?                                                                                                                                                                                                                                         | `true`                    |
| `USE_AUTHENTICATION`                                             | Does the Admin UI require authentication? For any real-world scenario this is _strongly_ recommended.                                                                                                                                                                | `true`                    |
| `GENERATE_EXAMPLE_DATA`                                          | Should World-Wide-Lab automatically generate some example data already? This will create a study called `example`.                                                                                                                                                   | `true`                    |
| `DATABASE_CHUNK_SIZE`                                            | Chunk-size to use for data export queries from the database, to avoid that World-Wide-Lab runs out of memory and crashes when exporting large amounts of data.                                                                                                       | `10000` (rows)            |
| `CREATE_STUDIES`                                                 | Shorthand to automatically create empty studies. This can be useful when you set up a local World-Wide-Lab for testing in e.g. a docker-compose file.                                                                                                                | `""` (no studies created) |
| `CREATE_LEADERBOARDS`                                            | Shorthand to automatically create empty leaderboards. This can be useful when you set up a local World-Wide-Lab for testing in e.g. a docker-compose file.                                                                                                           | `""` (no leaderboards)    |
| `WWL_ELECTRON_APP`                                               | **Internal.** Is World-Wide-Lab running as the Desktop App or Server. Do not set or modify this variable, it is automatically set to the correct value.                                                                                                              | `false`                   |
| `PUBLIC_IP_WHITELIST`                                            | Restrict access to _all_ endpoints to the listed IPs and / or subnets (in CIDR notation). Multiple entries can be separated by commas, e.g. `"127.0.0.1,10.0.0.0/8"`. Requests from other IPs are ignored completely, without any response being sent. If empty, access is not restricted.                                                              | `""` (no restriction)     |
| `PRIVATE_IP_WHITELIST`                                           | The same as `PUBLIC_IP_WHITELIST`, but only restricting access to the private endpoints i.e. the Admin UI and the API endpoints requiring an API key. Both whitelists can be used on their own or in combination, in which case requests to private endpoints have to match both.                                                                       | `""` (no restriction)     |
| `TRUST_PROXY`                                                    | Whether to trust proxy headers such as `X-Forwarded-For` when determining the IP a request originated from. Can be `true` / `false`, the number of proxies in front of World-Wide-Lab, or a list of trusted IPs / subnets. Only relevant if World-Wide-Lab runs behind a proxy or load balancer, see the section below.                                 | `false`                   |

## Restricting Access by IP

Access to World-Wide-Lab can be restricted to certain IP addresses and / or
subnets via two environment variables:

- `PUBLIC_IP_WHITELIST` restricts access to _all_ endpoints.
- `PRIVATE_IP_WHITELIST` restricts access to the private endpoints only, i.e.
  the Admin UI and the API endpoints requiring an API key. Note that
  participants taking part in a study only use public endpoints, so these
  remain accessible.

Both variables accept a comma-separated list of IP addresses (e.g.
`127.0.0.1` or `::1`) and subnets in CIDR notation (e.g. `10.0.0.0/8` or
`2001:db8::/32`). They can be used on their own or in combination: the public
whitelist always applies to the private endpoints as well, but not the other
way around.

```sh
# Only allow access from the office network, with the Admin UI and data
# downloads being restricted to a single computer within it
PUBLIC_IP_WHITELIST="203.0.113.0/24"
PRIVATE_IP_WHITELIST="203.0.113.42"
```

Requests from IPs that are not on the corresponding whitelist are ignored
completely: their connection is closed without any response being sent, which
also makes it more difficult to scan the server for vulnerabilities.

::: warning
If World-Wide-Lab runs behind a proxy or load balancer, all requests will
appear to come from that proxy, unless you also set `TRUST_PROXY`. Please
make sure to only trust proxies you control, since the headers used to
determine the original IP (e.g. `X-Forwarded-For`) can otherwise simply be
spoofed by whoever is sending a request.
:::
