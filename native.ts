import { app, IpcMainInvokeEvent, session } from "electron";

export interface ProxyConfig {
    enabled: boolean;
    type: "http" | "https" | "socks4" | "socks5";
    host: string;
    port: number;
    username: string;
    password: string;
    bypass: string;
}

let currentCreds: { username: string; password: string; } | null = null;
let loginListenerAttached = false;

function onLogin(
    event: Electron.Event,
    _webContents: Electron.WebContents,
    _details: Electron.AuthenticationResponseDetails,
    authInfo: Electron.AuthInfo,
    callback: (username?: string, password?: string) => void
) {
    if (!authInfo.isProxy || !currentCreds) return;
    event.preventDefault();
    callback(currentCreds.username, currentCreds.password);
}

function validate(cfg: ProxyConfig) {
    if (!["http", "https", "socks4", "socks5"].includes(cfg.type))
        throw new Error("Invalid proxy type");
    if (!/^[a-zA-Z0-9.\-_\[\]:]+$/.test(cfg.host))
        throw new Error("Invalid proxy host");
    if (!Number.isInteger(cfg.port) || cfg.port < 1 || cfg.port > 65535)
        throw new Error("Invalid proxy port");
}

export async function applyProxy(_: IpcMainInvokeEvent, cfg: ProxyConfig) {
    const ses = session.defaultSession;

    if (!cfg.enabled) {
        return clearProxy(_);
    }

    try {
        validate(cfg);
    } catch (e: any) {
        return { ok: false, error: String(e?.message ?? e) };
    }

    const proxyRules = `${cfg.type}://${cfg.host}:${cfg.port}`;
    const bypass = cfg.bypass.trim() || "<local>";

    currentCreds = cfg.username
        ? { username: cfg.username, password: cfg.password }
        : null;

    if (!loginListenerAttached) {
        app.on("login", onLogin);
        loginListenerAttached = true;
    }

    try {
        await ses.setProxy({
            mode: "fixed_servers",
            proxyRules,
            proxyBypassRules: bypass
        });
        // drop existing connections so they reconnect through the proxy
        await ses.closeAllConnections();
        return { ok: true, error: null };
    } catch (e: any) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}

export async function clearProxy(_: IpcMainInvokeEvent) {
    const ses = session.defaultSession;
    currentCreds = null;

    if (loginListenerAttached) {
        app.removeListener("login", onLogin);
        loginListenerAttached = false;
    }

    try {
        await ses.setProxy({ mode: "system" });
        await ses.closeAllConnections();
        return { ok: true, error: null };
    } catch (e: any) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}

export async function resolveCurrentProxy(_: IpcMainInvokeEvent, url = "https://discord.com") {
    return session.defaultSession.resolveProxy(url);
}