import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPostscript} from '../src/app.js';
const {parseHTML}=await import(process.env.POSTSCRIPT_DOM_RUNTIME || 'linkedom');
test('settings UI: save, toggle, preview escaping, request attachment, cleanup and reload',()=>{
 const {window,document}=parseHTML('<html><body><div id="extensions_settings"></div></body></html>');
 const handlers=new Map();let saved=0;
 const context={mainApi:'openai',extensionSettings:{},saveSettingsDebounced(){saved++;},substituteParams:t=>t.replace('{{char}}','Alice'),eventTypes:{CHAT_COMPLETION_SETTINGS_READY:'ready'},eventSource:{on:(k,f)=>handlers.set(k,f),makeLast:(k,f)=>handlers.set(k,f),removeListener:(k,f)=>{if(handlers.get(k)===f)handlers.delete(k);}}};
 const mount=()=>mountPostscript({getContext:()=>context,document});
 const app=mount(),find=n=>app.panel.querySelector(`[data-ps="${n}"]`);
 const toggle=()=>{find('enabled').checked=!find('enabled').checked;find('enabled').dispatchEvent(new window.Event('change',{bubbles:true}));};
 const edit=(n,v)=>{find(n).value=v;find(n).dispatchEvent(new window.Event('input',{bubbles:true}));};
 assert.equal(find('enabled').checked,false);toggle();assert.equal(find('enabled').checked,false);
 edit('assistant','Which mood?');edit('user','{{char}} <script>test</script>');toggle();assert.equal(context.extensionSettings.st_postscript.enabled,true);
 assert.equal(app.panel.querySelector('script'),null);
 const payload={type:'normal',messages:[{role:'user',content:'original'}]};handlers.get('ready')(payload);
 assert.equal(payload.messages.at(-1).content,'Alice <script>test</script>');assert(app.panel.querySelector('.ps-last').textContent.includes('2개'));
 toggle();assert.equal(context.extensionSettings.st_postscript.user,'{{char}} <script>test</script>');
 toggle();edit('user','');assert.equal(context.extensionSettings.st_postscript.enabled,false);
 edit('user','Saved');app.cleanup();assert.equal(handlers.size,0);assert.equal(document.querySelector('#st-postscript-settings'),null);
 const again=mount();assert.equal(again.panel.querySelector('[data-ps=user]').value,'Saved');again.cleanup();assert(saved>0);
});
test('unsupported event API keeps toggle disabled and does not subscribe',()=>{
 const {document}=parseHTML('<html><body><div id="extensions_settings2"></div></body></html>');
 const app=mountPostscript({document,getContext:()=>({extensionSettings:{},saveSettingsDebounced(){}})});
 assert(app.panel.querySelector('[data-ps=enabled]').disabled);app.cleanup();
});
