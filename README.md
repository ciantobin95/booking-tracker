# booking-tracker
Organise your flight and hotel bookings into one easy user interface

## Gemini API key

The AI booking parser needs a Google Gemini key. The key lives in the `GEMINI_API_KEY` environment variable, or, if that is unset, in an untracked `config.local.php`. It is not stored in the repository. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).

### Locally

Export the variable in the shell that starts PHP:

```bash
export GEMINI_API_KEY=your-gemini-api-key-here
php -S localhost:8000
```

If you keep the value in a file, copy `.env.example` to `.env` and load it into the environment before starting PHP (`set -a && source .env && set +a`). PHP does not read `.env` on its own.

If you cannot set environment variables, copy `config.example.php` to `config.local.php` and put the key in that file. `config.local.php` and `.env` are gitignored.

When the key is missing, PHP writes a server log line saying `GEMINI_API_KEY` is not configured and the browser gets a generic JSON error. The key is not included in that response or in the log.

### On the host

Set `GEMINI_API_KEY` in the host environment, then restart PHP.

- Apache: set the variable in the vhost, or in the panel's environment settings. Do not commit a file that contains the real key.
- nginx with PHP-FPM: set `env[GEMINI_API_KEY]` in the pool config, or pass it with `fastcgi_param`.
- Docker or systemd: set the variable on the service.

The request sends the key in the `x-goog-api-key` header so it is not part of the URL.
