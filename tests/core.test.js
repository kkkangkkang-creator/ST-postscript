import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSettings,createAppender} from '../src/core.js';
const settings={enabled:true,assistant:'What mood?',user:'Warm.'};
const messages=()=>[{role:'system',content:'RULES'},{role:'user',content:'REQUEST'}];
test('default off and stored text preserved while disabled',()=>{
 assert.deepEqual(cleanSettings(),{enabled:false,assistant:'',user:''});
 assert.deepEqual(cleanSettings({...settings,enabled:false}),{...settings,enabled:false});
 assert.equal(cleanSettings({enabled:'true'}).enabled,false);
});
test('normal, regenerate and swipe append real roles without changing original messages',()=>{
 for(const type of [undefined,'','normal','regenerate','swipe']){
  const original=messages(),snapshot=structuredClone(original),payload={type,messages:original};
  assert.equal(createAppender()(payload,settings).status,'applied');
  assert.deepEqual(payload.messages,[...original,{role:'assistant',content:'What mood?'},{role:'user',content:'Warm.'}]);
  assert.deepEqual(original,snapshot);assert.notEqual(payload.messages,original);
 }
});
test('quiet, impersonation, continuation, dry runs and unknown types are untouched',()=>{
 for(const type of ['quiet','impersonate','continue','other']){
  const original=messages(),p={type,messages:original};assert.equal(createAppender()(p,settings).status,'skip');assert.equal(p.messages,original);
 }
 const p={type:'normal',dryRun:true,messages:messages()};assert.equal(createAppender()(p,settings).status,'skip');
});
test('reprocessing is idempotent, updates content and removes only own suffix when toggled off',()=>{
 const append=createAppender(),p={type:'normal',messages:messages()};
 append(p,settings);append(p,settings);assert.equal(p.messages.length,4);
 append(p,{...settings,user:'New'});assert.equal(p.messages.length,4);assert.equal(p.messages.at(-1).content,'New');
 append(p,{...settings,enabled:false});assert.deepEqual(p.messages,messages());
});
test('identical genuine dialogue is retained and separate requests do not accumulate suffixes',()=>{
 const append=createAppender();
 const original=[...messages(),{role:'assistant',content:settings.assistant},{role:'user',content:settings.user}];
 const p={messages:original};append(p,settings);assert.equal(p.messages.length,6);assert.equal(original.length,4);
 const next={messages:original};append(next,settings);assert.equal(next.messages.length,6);
});
test('blank or macro-expanded blank text never produces a partial suffix',()=>{
 for(const value of [{...settings,user:' '},{...settings,assistant:''}]){
  const p={messages:messages()};assert.equal(createAppender()(p,value).status,'invalid');assert.equal(p.messages.length,2);
 }
 const p={messages:messages()};assert.equal(createAppender()(p,settings,()=> '').status,'invalid');assert.equal(p.messages.length,2);
});
test('macros are expanded at send time, template remains unchanged',()=>{
 const p={messages:messages()},s={...settings,user:'{{char}} and {{user}}'};
 createAppender()(p,s,t=>t.replace('{{char}}','A').replace('{{user}}','B'));
 assert.equal(p.messages.at(-1).content,'A and B');assert.equal(s.user,'{{char}} and {{user}}');
});
test('tool call and tool result tails are not interrupted',()=>{
 for(const row of [{role:'tool',content:'Result'},{role:'assistant',tool_calls:[{}]},{role:'function',content:'Result'},{role:'assistant',function_call:{}}]){
  const p={messages:[...messages(),row]};assert.equal(createAppender()(p,settings).status,'tools');assert.equal(p.messages.length,3);
 }
});
