import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/store.js';
import { moderate, authorize } from '../src/moderation.js';
const input = {guild:'g',target:'t',moderator:'m',action:'warn',reason:'Repeated spam'};
test('cases persist, remain guild-scoped, and record failures', async () => {
  const s=openStore();
  try {
    const id=await moderate(s,input,async()=>{});
    assert.equal(s.getCase('g',id).status,'completed');
    assert.equal(s.getCase('other',id),undefined);
    await assert.rejects(moderate(s,input,async()=>{throw Error('API failed');}));
    assert.equal(s.history('g','t')[0].status,'failed');
    assert.equal(s.history('g','someone').length,0);
  } finally {s.close();}
});
test('invalid timeouts and empty reasons never execute or create cases',async()=>{
  const s=openStore(); let called=false;
  try {
    for(const value of [0,40321,1.5]) await assert.rejects(moderate(s,{...input,action:'timeout',duration:value},async()=>{called=true;}));
    await assert.rejects(moderate(s,{...input,reason:' '},async()=>{called=true;}));
    assert.equal(called,false); assert.equal(s.history('g','t').length,0);
  } finally{s.close();}
});
function member(id,rank,allowed=true){return {id,permissions:{has:()=>allowed},roles:{highest:{rank,comparePositionTo(other){return rank-other.rank;}}},moderatable:true,kickable:true,bannable:true};}
test('role hierarchy, owner protection and both permission checks',()=>{
  const context={actor:member('a',5),bot:member('b',8),target:member('t',2),ownerId:'owner',action:'ban'};
  assert.doesNotThrow(()=>authorize(context));
  for(const patch of [{actor:member('a',5,false)},{bot:member('b',8,false)},{target:member('owner',1)},{target:member('a',1)},{target:member('t',5)},{target:member('t',9)}])
    assert.throws(()=>authorize({...context,...patch}));
  assert.doesNotThrow(()=>authorize({...context,actor:member('owner',1)}));
});
test('settings can be updated and disabled independently per guild',()=>{
  const s=openStore();try{s.setLog('a','one');s.setLog('b','two');s.setLog('a',null);assert.equal(s.logChannel('a'),null);assert.equal(s.logChannel('b'),'two');}finally{s.close();}
});
test('history pages expose older cases without overlapping guilds or members',()=>{
  const s=openStore();
  try{
    for(let n=0;n<8;n++)s.create({...input,reason:`Reason ${n}`});
    s.create({...input,guild:'other'});s.create({...input,target:'another'});
    assert.equal(s.historyCount('g','t'),8);
    assert.deepEqual(s.history('g','t',1).map(c=>c.id),[8,7,6]);
    assert.deepEqual(s.history('g','t',2).map(c=>c.id),[5,4,3]);
    assert.deepEqual(s.history('g','t',3).map(c=>c.id),[2,1]);
    assert.deepEqual(s.history('g','t',4),[]);
    for(const page of [0,-1,1.5,100001,'1'])assert.throws(()=>s.history('g','t',page));
  }finally{s.close();}
});
test('history slash command exposes an optional bounded page',async()=>{
  const {commands}=await import('../src/commands.js');
  const command=commands.find(c=>c.name==='history').toJSON();
  assert.equal(command.options.find(o=>o.name==='page').min_value,1);
  assert.equal(command.options.find(o=>o.name==='page').max_value,100000);
  for(const c of commands)assert.ok(c.toJSON().name);
});
