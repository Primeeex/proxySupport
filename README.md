# proxySupport

A Vencord userplugin that routes Discord traffic through an HTTP, HTTPS, SOCKS4, or SOCKS5 proxy.

Proxy settings are configurable from Vencord settings and are applied through the Electron main process with debounced updates and success/failure toasts.

## Quick Setup

Upload the plugin folder to the location where it belongs in your Vencord source tree, then run:

```powershell
Remove-Item -Recurse -Force dist
pnpm build
pnpm inject
```

After injection, enable `proxySupport` in Vencord if needed.

## Installation

1. Put the plugin folder in `src/userplugins/<Name>/`.
2. Export a default `definePlugin` from `index.tsx` or `index.ts`.
3. Because this plugin uses Electron main-process APIs, include `native.ts`.
4. The native helper is exposed through `VencordNative.pluginHelpers.ProxySupport`.
5. Use Vencord APIs such as `@api/*`, `@utils/*`, and `@webpack/common`.
6. Rebuild/reinject after making changes.

For development, `pnpm watch` can be used instead of a full rebuild.

## Settings

The plugin exposes the following settings through `definePluginSettings`:

| Setting | Description |
| --- | --- |
| `enabled` | Enables or disables proxy routing. |
| `type` | Proxy type: `http`, `https`, `socks4`, or `socks5`. |
| `host` | Proxy hostname or address. |
| `port` | Proxy port. |
| `username` | Proxy username. |
| `password` | Proxy password. |
| `bypass` | Proxy bypass rules. |

Every setting change schedules `apply()` with a `600ms` debounce. This prevents rapid edits, especially while entering hostnames, ports, or credentials, from repeatedly sending IPC requests to the main process.

> **Security note:** The password is stored as plain text in Vencord settings, as indicated by the plugin's setting description.

## How It Works

### Renderer

- `apply()` gathers the current settings and calls `Native.applyProxy(cfg)`.
- Successful applications display a success toast.
- Failures display a failure toast.
- `start()` applies the proxy only when `enabled` is true.
- `stop()` clears any pending debounce timer and calls `Native.clearProxy()`.

### Native main-process helper

The native implementation handles the Electron session and proxy configuration.

#### `applyProxy(event, cfg)`

1. If the plugin is disabled, the current proxy is cleared.
2. `validate(cfg)` verifies:
   - Proxy type is one of the supported values.
   - Host matches `^[a-zA-Z0-9.\-_\[\]:]+$`.
   - Port is an integer from `1` through `65535`.
3. The proxy rule is constructed as:
   ```text
   <type>://<host>:<port>
   ```
4. If no bypass value is supplied, `<local>` is used.
5. Credentials are kept in module-level `currentCreds`.
6. A one-time Electron `app.on("login", ...)` listener handles proxy authentication challenges when `authInfo.isProxy` is true.
7. `session.defaultSession.setProxy()` applies the fixed proxy configuration.
8. `closeAllConnections()` forces existing connections to reconnect through the new proxy.
9. The function returns `{ ok, error }` so validation/application failures do not escape as renderer exceptions.

#### `clearProxy`

- Removes stored credentials.
- Removes the proxy login listener.
- Restores `session.defaultSession` to system proxy mode.
- Closes existing connections so they reconnect using the restored configuration.

#### `resolveCurrentProxy(url)`

Exposes Electron's `session.defaultSession.resolveProxy` for resolving the proxy associated with a URL. It is currently available to callers but is not used by `index`.

## Proxy Authentication

HTTP/HTTPS proxy credentials are handled through Electron's `login` event.

SOCKS4/SOCKS5 authentication is not handled through that same mechanism. The username field therefore only applies to the authentication flow currently supported by the native implementation.

## Cleanup

The plugin clears pending debounce work and restores system proxy behavior when stopped.

The native helper also removes its proxy-authentication listener and clears stored credentials when the proxy is cleared.

## Notes

- The native helper key is exactly `"ProxySupport"`, matching the plugin's `name: "ProxySupport"`.
- Validation failures are returned as `{ ok: false }` and surfaced through a failure toast.
- The plugin uses `session.defaultSession`, so applying or clearing the proxy affects the Discord session handled by that Electron session.
