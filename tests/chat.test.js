import test from 'node:test';
import assert from 'node:assert/strict';
import { createChat } from '../src/chat.js';
import { createInterpreter } from '../src/openai.js';
const intent = { intent: 'offer', targetPaise: 90000, currency: 'INR', confidence: .99, topic: 'other' };
test('AI offer requires confirmation, then merchant rules counteroffer', async () => {
 const chat = createChat({ interpret: async () => intent }); const {id} = await chat({action:'start'});
 const reply = await chat({id,message:'Can you do 900?'}); assert.equal(reply.confirmPrice,true);
 const result = await chat({id,action:'confirm'}); assert.equal(result.amount,95904); assert.equal(result.round,1);
 await assert.rejects(chat({id,action:'confirm'}));
});
test('AI outage preserves numeric fallback and does not spend a round', async () => {
 const chat = createChat({ interpret: async () => { throw Error('offline'); } }); const {id} = await chat({action:'start'});
 assert.equal((await chat({id,message:'Can you do 900?'})).mode,'fallback');
 assert.equal((await chat({id,message:'900'})).round,1);
});
test('foreign currency and unclear requests never generate prices', async () => {
 for (const value of [{...intent,currency:'other'},{...intent,confidence:.5},{...intent,intent:'clarify'}]) {
 const chat = createChat({interpret:async()=>value}); const {id}=await chat({action:'start'});
 assert.equal((await chat({id,message:'offer'})).confirmPrice,false);
 await assert.rejects(chat({id,action:'confirm'}));
 }
});
test('concurrent AI turns blocked', async () => {
 let finish; const chat=createChat({interpret:()=>new Promise(r=>{finish=r;})}); const {id}=await chat({action:'start'});
 const first=chat({id,message:'hello'}); await assert.rejects(chat({id,message:'900'}),/MESSAGE_IN_PROGRESS/);
 finish({...intent,intent:'greeting'}); await first;
});
test('OpenAI request contains public facts only and validates output', async () => {
 let payload;
 const interpret=createInterpreter({apiKey:'test',model:'test-model',fetchImpl:async(url,req)=>{
  payload=JSON.parse(req.body);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(intent)}]}]})};
 }});
 assert.deepEqual(await interpret({message:'Can you do 900?',product:{title:'Test',size:'50ml',scent:'fresh',floor:87500}}),intent);
 assert.equal(payload.store,false); assert.equal(JSON.stringify(payload).includes('87500'),false);
 assert.equal(payload.text.format.strict,true);
});
test('malformed, refused and incomplete model output rejected', async () => {
 for(const result of [{status:'incomplete'}, {status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},
 {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...intent,targetPaise:-1})}]}]}]) {
 const interpret=createInterpreter({apiKey:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>result})});
 await assert.rejects(interpret({message:'test',product:{title:'test'}}));
 }
});
