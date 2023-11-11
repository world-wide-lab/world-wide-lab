# Configuring The World-Wide-Lab Server

_Coming soon..._

## List of Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_UI` | Should the administration interface at `/admin` be enabled? | `true` |
| `API_DOCS` | Should documentation for the API be made available by the server at `/api-docs`? | `true` |
| `DATABASE_URL` (**required**) | The URL pointing to the database, including credentials. | _No Default_ |
| `ADMIN_AUTH_SESSION_SECRET` (_required if `ADMIN_UI` is true_) | A random, secret piece of information used to secure authentication sessions. Required and should be random characters. | _No Default_ |
| `ADMIN_AUTH_DEFAULT_EMAIL` (_required if `ADMIN_UI` is true_) | The default email to use to login to the Admin UI. Use something secure and non-obvious here. | _No Default_ |
| `ADMIN_AUTH_DEFAULT_PASSWORD` (_required if `ADMIN_UI` is true_) | The default password to use to login to the Admin UI. Use something secure and non-obvious here. | _No Default_ |
| `DEFAULT_API_KEY` | The token to use to authenticate with the World-Wide-Lab API for use with protected endpoints to e.g. download data. If not provided, these endpoints will be unavailable. This is not needed for standard usage, such as adding responses / data to World-Wide-Lab. | _No Default_ |
| `WWL_ENV_FILE` | Which file to load environment variables from (additionally to the ones set in the actual environment) | `".env"` |
| `ROOT` | The root URL where World-Wide-Lab is running. | `"http://localhost"` |
| `PORT` | The port at which World-Wide-Lab is running | `8787` |
| `LOGGING_DIR` | Which directory to write logs to. | `"logs"` |
| `LOGGING_LEVEL_CONSOLE` | At which level default logs should be written. From coarse to detailed, the available levels are: `error`, `warn`, `info`, `http`, `sql`, `verbose`, `debug`, `silly`. Typically info or verbose are reccommended. | `"info"` |
| `LOGGING_HTTP` | Should HTTP calls be logged? | `true` |
| `USE_AUTHENTICATION` | Does the Admin UI require authentication? For any real-world scenario this is *strongly* recommended. | `true` |
| `GENERATE_EXAMPLE_DATA` | Should World-Wide-Lab automatically generate some example data already? This will create a study called `example`. | `true` |
| `DATABASE_CHUNK_SIZE` | Chunk-size to use for data export queries from the database, to avoid that World-Wide-Lab runs out of memory and crashes when exporting large amounts of data. | `10000` (rows) |
| `CREATE_STUDIES` | Shorthand to automatically create empty studies. This can be useful when you set up a local World-Wide-Lab for testing in e.g. a docker-compose file. | `""` (no studies created) |
| `WWL_ELECTRON_APP` | **Internal.** Is World-Wide-Lab running as the Desktop App or Server. Do not set or modify this variable, it is automatically set to the correct value. | `false` |
