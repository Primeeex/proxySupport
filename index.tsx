import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

const Native = VencordNative.pluginHelpers.ProxySupport as PluginNative<typeof import("./native")>;

async function apply() {
    const s = settings.store;
    const res = await Native.applyProxy({
        enabled: s.enabled,
        type: s.type as any,
        host: s.host,
        port: Number(s.port),
        username: s.username,
        password: s.password,
        bypass: s.bypass
    });

    if (res.ok) {
        showToast(s.enabled ? "Proxy applied" : "Proxy disabled", Toasts.Type.SUCCESS);
    } else {
        showToast(`Proxy error: ${res.error}`, Toasts.Type.FAILURE);
    }
}

// small debounce so typing in text fields doesn't spam the main process
let timer: ReturnType<typeof setTimeout> | undefined;
const scheduleApply = () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 600);
};

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Route Discord traffic through the proxy",
        default: false,
        onChange: scheduleApply
    },
    type: {
        type: OptionType.SELECT,
        description: "Proxy protocol",
        options: [
            { label: "HTTP", value: "http", default: true },
            { label: "HTTPS", value: "https" },
            { label: "SOCKS4", value: "socks4" },
            { label: "SOCKS5", value: "socks5" }
        ],
        onChange: scheduleApply
    },
    host: {
        type: OptionType.STRING,
        description: "Proxy host (e.g. 127.0.0.1)",
        default: "127.0.0.1",
        onChange: scheduleApply
    },
    port: {
        type: OptionType.NUMBER,
        description: "Proxy port",
        default: 1080,
        onChange: scheduleApply
    },
    username: {
        type: OptionType.STRING,
        description: "Username (HTTP/HTTPS proxies only; leave empty if none)",
        default: "",
        onChange: scheduleApply
    },
    password: {
        type: OptionType.STRING,
        description: "Password (stored in plain text in Vencord settings)",
        default: "",
        onChange: scheduleApply
    },
    bypass: {
        type: OptionType.STRING,
        description: "Bypass list, comma-separated (e.g. <local>,*.example.com,10.0.0.0/8)",
        default: "<local>",
        onChange: scheduleApply
    }
});

export default definePlugin({
    name: "ProxySupport",
    description: "Route Discord through an HTTP/HTTPS/SOCKS4/SOCKS5 proxy",
    authors: [{ name: "you", id: 0n }],
    settings,

    start() {
        if (settings.store.enabled) apply();
    },

    stop() {
        clearTimeout(timer);
        Native.clearProxy();
    }
});