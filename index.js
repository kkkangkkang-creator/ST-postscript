import { mountPostscript } from './src/app.js';
let instance = null;
let enabled = true;
function notify(text) { globalThis.toastr?.warning(text, 'P.S. — 추신'); }
export function onEnable() {
    enabled = true;
    if (instance) return;
    try {
        instance = mountPostscript({ getContext: () => SillyTavern.getContext(), document, notify });
    } catch (error) {
        console.error('[P.S. — 추신]', error);
        notify(error.message);
    }
}
export function onDisable() {
    enabled = false;
    instance?.cleanup();
    instance = null;
}
const start = () => { if (enabled) onEnable(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
