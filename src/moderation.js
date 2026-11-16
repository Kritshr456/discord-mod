import { PermissionFlagsBits as P } from 'discord.js';
export class UserError extends Error {}
export const required = { warn: P.ModerateMembers, timeout: P.ModerateMembers, untimeout: P.ModerateMembers, kick: P.KickMembers, ban: P.BanMembers };
export function authorize({ actor, target, bot, ownerId, action }) {
  const permission = required[action];
  if (!permission) throw new UserError('Unknown moderation action.');
  if (!actor.permissions.has(permission)) throw new UserError('You lack the required permission.');
  if (!bot.permissions.has(permission)) throw new UserError('The bot lacks the required permission.');
  if ([actor.id, bot.id, ownerId].includes(target.id)) throw new UserError('That member cannot be targeted.');
  if (actor.id !== ownerId && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0)
    throw new UserError('Your highest role must be above the target.');
  if (bot.roles.highest.comparePositionTo(target.roles.highest) <= 0)
    throw new UserError('The bot role must be above the target.');
  if (['timeout','untimeout'].includes(action) && !target.moderatable)
    throw new UserError('Discord does not allow this member to be timed out.');
  if (action === 'kick' && !target.kickable) throw new UserError('This member cannot be kicked.');
  if (action === 'ban' && !target.bannable) throw new UserError('This member cannot be banned.');
}
export async function moderate(store, input, execute) {
  if (!required[input.action]) throw new UserError('Unknown action.');
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 400)
    throw new UserError('Supply a reason between 1 and 400 characters.');
  if (input.action === 'timeout' && (!Number.isInteger(input.duration) || input.duration < 1 || input.duration > 40320))
    throw new UserError('Timeout must be 1–40320 minutes.');
  const id = store.create(input);
  try { await execute(); }
  catch (error) { store.finish(id, 'failed'); throw error; }
  store.finish(id, 'completed');
  return id;
}
