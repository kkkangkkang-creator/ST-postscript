export const SETTINGS_KEY = 'st_postscript';
export function cleanSettings(value = {}) {
    return {
        enabled: value?.enabled === true,
        assistant: typeof value?.assistant === 'string' ? value.assistant : '',
        user: typeof value?.user === 'string' ? value.user : '',
    };
}
export function valid(settings) {
    return Boolean(settings.assistant.trim() && settings.user.trim());
}
const supportedTypes = new Set([undefined, null, '', 'normal', 'regenerate', 'swipe']);
/** Only mutate the request envelope; never mutate the original message array or chat. */
export function createAppender() {
    const inserted = new WeakSet();
    return (payload, value, expand = text => text) => {
        const settings = cleanSettings(value);
        if (!payload || payload.dryRun || !Array.isArray(payload.messages)) return { status: 'skip' };
        // Also removes our own rows if a request is processed twice or switched off before resending.
        const base = payload.messages.filter(row => !inserted.has(row));
        if (base.length !== payload.messages.length) payload.messages = base;
        if (!supportedTypes.has(payload.type)) return { status: 'skip' };
        if (!settings.enabled) return { status: 'off' };
        if (!valid(settings)) return { status: 'invalid' };
        const tail = base.at(-1);
        // Keep function/tool responses adjacent to their corresponding calls.
        if (tail?.role === 'tool' || tail?.role === 'function' || tail?.tool_calls?.length || tail?.function_call) {
            return { status: 'tools' };
        }
        if (!base.length) return { status: 'skip' };
        const assistant = String(expand(settings.assistant));
        const user = String(expand(settings.user));
        if (!assistant.trim() || !user.trim()) return { status: 'invalid' };
        const suffix = [{ role: 'assistant', content: assistant }, { role: 'user', content: user }];
        suffix.forEach(row => inserted.add(row));
        payload.messages = [...base, ...suffix];
        return { status: 'applied', suffix };
    };
}
