import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.js';
import { handleCaseCommand } from '../src/case-commands.js';
const input={guild:'g',target:'t',moderator:'m',action:'warn',reason:'Private reason'};

test('activity summaries isolate guilds, time windows and case outcomes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mod-stats-'));const path=join(dir,'app.sqlite'),s=openStore(path);
 try{
  const done=s.create(input);s.finish(done,'completed');s.addNote('g',done,'m','A note');
  const failed=s.create({...input,action:'ban'});s.finish(failed,'failed');
  const old=s.create(input);s.create({...input,guild:'other'});
  const db=new DatabaseSync(path);db.prepare("UPDATE cases SET created=datetime('now','-2 days') WHERE id=?").run(old);db.close();
  assert.equal(s.stats('g',1).total,2);assert.equal(s.stats('g',30).total,3);
  assert.deepEqual(s.stats('g',1).rows.map(r=>[r.action,r.status,r.total]),[['ban','failed',1],['warn','completed',1]]);
  assert.equal(s.stats('other',30).total,1);assert.equal(s.stats('empty').total,0);
  for(const days of [0,366,1.5,'30',true])assert.throws(()=>s.stats('g',days));
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('statistics command checks permissions and reveals no case reasons',async()=>{
 const s=openStore();try{
  s.create(input);let reply;
  const i={commandName:'mod-stats',guildId:'g',options:{getInteger:()=>7},editReply:async text=>{reply=text;}};
  await assert.rejects(handleCaseCommand(i,{permissions:{has:()=>false}},s));
  assert.equal(await handleCaseCommand(i,{permissions:{has:()=>true}},s),true);
  assert.match(reply,/Last 7 days.*1 cases/);assert.ok(!reply.includes('Private reason'));
 }finally{s.close();}
});
