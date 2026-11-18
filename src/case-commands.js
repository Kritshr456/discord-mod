import { PermissionFlagsBits as P } from 'discord.js';
import { UserError } from './moderation.js';

export async function handleCaseCommand(i, actor, store) {
  if (!['case-note', 'case-notes'].includes(i.commandName)) return false;
  if (!actor.permissions.has(P.ModerateMembers)) throw new UserError('Moderate Members is required.');
  const id = i.options.getInteger('id', true);
  if (i.commandName === 'case-note') {
    const noteId = store.addNote(i.guildId, id, actor.id, i.options.getString('note', true));
    await i.editReply(`Note #${noteId} added to case #${id}.`);
  } else {
    const result = store.notes(i.guildId, id, i.options.getInteger('page') || 1);
    await i.editReply(`Case #${id} • Page ${result.page} • ${result.total} notes\n\n` +
      (result.rows.map(n => `Note #${n.id} • <@${n.moderator}> • ${n.created} UTC\n${n.note}`).join('\n\n') || 'No notes on this page.'));
  }
  return true;
}
