import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyModerationResult } from '../src/notifications.js';

const result = { id: 42, action: 'warn', target: 'target', reason: 'Keep discussions civil' };
function fixture() {
  const replies = [], logs = [];
  const interaction = {
    user: { id: 'moderator' },
    editReply: async text => replies.push(text),
    guild: { channels: { fetch: async () => ({ send: async payload => logs.push(payload) }) } },
  };
  return { interaction, replies, logs };
}

test('private reply failure still delivers the moderation log without mentions', async () => {
  const { interaction, logs } = fixture();
  interaction.editReply = async () => { throw Error('Interaction expired'); };
  await notifyModerationResult(interaction, result, 'log-channel');
  assert.equal(logs.length, 1);
  assert.match(logs[0].content, /Case #42/);
  assert.match(logs[0].content, /Keep discussions civil/);
  assert.deepEqual(logs[0].allowedMentions, { parse: [] });
});

test('failed log delivery preserves the private success reply', async () => {
  const { interaction, replies } = fixture();
  interaction.guild.channels.fetch = async () => { throw Error('Missing channel'); };
  await notifyModerationResult(interaction, result, 'log-channel');
  assert.deepEqual(replies, ['Case #42: warn recorded.']);
});

test('both notification failures leave the completed action successful', async () => {
  const { interaction } = fixture();
  interaction.editReply = async () => { throw Error('Interaction expired'); };
  interaction.guild.channels.fetch = async () => { throw Error('Missing access'); };
  await assert.doesNotReject(notifyModerationResult(interaction, result, 'log-channel'));
});

test('disabled logging never fetches a channel', async () => {
  const { interaction, replies } = fixture();
  interaction.guild.channels.fetch = async () => assert.fail('Logging is disabled');
  await notifyModerationResult(interaction, result, null);
  assert.equal(replies.length, 1);
});
