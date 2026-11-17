import { Client, GatewayIntentBits, Events, PermissionFlagsBits as P, MessageFlags } from 'discord.js';
import { openStore } from './store.js';
import { authorize, moderate, required, UserError } from './moderation.js';
if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
const store = openStore(process.env.DATABASE_PATH || './data/app.sqlite');
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [] } });
const busy = new Set();
client.on(Events.InteractionCreate, async i => {
  if (!i.isChatInputCommand() || !i.inGuild()) return;
  const key = `${i.guildId}:${i.options.getUser('member')?.id ?? i.user.id}`;
  try {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const actor = await i.guild.members.fetch(i.user.id);
    if (i.commandName === 'mod-config') {
      if (!actor.permissions.has(P.ManageGuild)) throw new UserError('Manage Server is required.');
      const channel = i.options.getChannel('channel');
      const bot = await i.guild.members.fetchMe();
      if (channel && !channel.permissionsFor(bot)?.has([P.ViewChannel,P.SendMessages])) throw new UserError('The bot cannot send messages in that channel.');
      store.setLog(i.guildId, channel?.id ?? null);
      return await i.editReply(channel ? 'Log channel saved.' : 'Logs disabled.');
    }
    if (['history','case'].includes(i.commandName)) {
      if (!actor.permissions.has(P.ModerateMembers)) throw new UserError('Moderate Members is required.');
      const page = i.commandName === 'history' ? i.options.getInteger('page') ?? 1 : 1;
      const target = i.commandName === 'history' ? i.options.getUser('member',true).id : null;
      const total = target ? store.historyCount(i.guildId,target) : 0;
      const heading = target ? `Page ${page} • ${total} cases • ${Math.max(1,Math.ceil(total/3))} pages\n\n` : '';
      const rows = i.commandName === 'history' ? store.history(i.guildId,target,page)
        : [store.getCase(i.guildId,i.options.getInteger('id',true))].filter(Boolean);
      return await i.editReply(heading + (rows.map(c => `#${c.id} ${c.action} • ${c.status} • <@${c.target}> • by <@${c.moderator}>${c.duration ? ` • ${c.duration} minutes` : ''}\n${c.reason}\n${c.created} UTC`).join('\n\n').slice(0,1900) || 'No cases found on this page.'));
    }
    if (!required[i.commandName]) return await i.editReply('Unknown command.');
    if (busy.has(key)) throw new UserError('Another moderation action is already running for this member.');
    busy.add(key);
    try {
      const target = await i.guild.members.fetch(i.options.getUser('member',true).id).catch(() => null);
      if (!target) throw new UserError('That user is not a member of this server.');
      const bot = await i.guild.members.fetchMe();
      authorize({actor,target,bot,ownerId:i.guild.ownerId,action:i.commandName});
      const reason = i.options.getString('reason',true).trim();
      const duration = i.options.getInteger('minutes');
      const audit = `${i.user.id}: ${reason}`;
      const id = await moderate(store,{guild:i.guildId,target:target.id,moderator:i.user.id,action:i.commandName,reason,duration}, async () => {
        if (i.commandName === 'timeout') await target.timeout(duration * 60000,audit);
        if (i.commandName === 'untimeout') await target.timeout(null,audit);
        if (i.commandName === 'kick') await target.kick(audit);
        if (i.commandName === 'ban') await target.ban({reason:audit});
      });
      await i.editReply(`Case #${id}: ${i.commandName} recorded.`);
      const channelId = store.logChannel(i.guildId);
      if (channelId) {
        try {
          const channel = await i.guild.channels.fetch(channelId);
          await channel.send({content:`Case #${id} • ${i.commandName} • <@${target.id}> • moderator <@${i.user.id}>\n${reason}`,allowedMentions:{parse:[]}});
        } catch { console.error(`Case ${id}: log delivery failed; case remains saved.`); }
      }
    } finally { busy.delete(key); }
  } catch (error) {
    const content = error instanceof UserError ? error.message : 'The action could not be completed. Check bot permissions and try again.';
    if (!(error instanceof UserError)) console.error('Interaction failed', {code:error.code ?? 'unknown'});
    try { if (i.deferred || i.replied) await i.editReply(content); else await i.reply({content,flags:MessageFlags.Ephemeral}); } catch { /* Interaction may have expired. */ }
  }
});
client.once(Events.ClientReady, () => console.log('Moderation bot ready.'));
client.on(Events.Error, () => console.error('Discord client error.'));
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { client.destroy(); store.close(); });
await client.login(process.env.DISCORD_TOKEN);
