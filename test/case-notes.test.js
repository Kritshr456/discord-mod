import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.js';
import { handleCaseCommand } from '../src/case-commands.js';
import { commands } from '../src/commands.js';
const input = { guild: 'g', target: 't', moderator: 'm', action: 'warn', reason: 'Original reason' };

test('notes preserve the original case, paginate and cannot cross guild boundaries', () => {
  const s = openStore();
  try {
    const id = s.create(input), original = s.getCase('g', id);
    for (let n = 0; n < 7; n++) s.addNote('g', id, 'moderator', `Note ${n}`);
    assert.deepEqual(s.getCase('g', id), original);
    assert.equal(s.notes('g', id).total, 7);
    assert.deepEqual(s.notes('g', id, 2).rows.map(n => n.note), ['Note 3','Note 2','Note 1']);
    assert.equal(s.notes('g', id, 3).rows.length, 1);
    assert.throws(() => s.notes('other', id)); assert.throws(() => s.addNote('other', id, 'm', 'Hidden'));
    for (const text of [' ', 'x'.repeat(401), null]) assert.throws(() => s.addNote('g', id, 'm', text));
    assert.throws(() => s.notes('g', id, 0)); assert.equal(s.notes('g', id).total, 7);
  } finally { s.close(); }
});
test('note commands check runtime permissions before reading or writing', async () => {
  const s = openStore();
  try {
    const id = s.create(input), replies = [];
    const i = { guildId:'g', commandName:'case-note', options:{getInteger: key=>key==='id'?id:1,getString:()=> 'Investigation update'},editReply:async text=>replies.push(text) };
    await assert.rejects(handleCaseCommand(i,{id:'m',permissions:{has:()=>false}},s));
    assert.equal(s.notes('g',id).total,0);
    assert.equal(await handleCaseCommand(i,{id:'m',permissions:{has:()=>true}},s),true);
    i.commandName='case-notes';await handleCaseCommand(i,{id:'m',permissions:{has:()=>true}},s);
    assert.match(replies[1],/Investigation update/);
    for(const c of commands)assert.ok(c.toJSON().name);
  } finally { s.close(); }
});
test('case notes persist across restart', () => {
  const dir=mkdtempSync(join(tmpdir(),'mod-notes-'));
  try {
    const path=join(dir,'app.sqlite');let s=openStore(path);const id=s.create(input);s.addNote('g',id,'m','Saved note');s.close();
    s=openStore(path);assert.equal(s.notes('g',id).rows[0].note,'Saved note');s.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
