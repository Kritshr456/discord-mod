import { SlashCommandBuilder, PermissionFlagsBits as P, ChannelType } from 'discord.js';
import { required } from './moderation.js';
export const commands = Object.entries(required).map(([name,permission]) => {
  const command = new SlashCommandBuilder().setName(name).setDescription(`${name} a member`)
    .setDMPermission(false).setDefaultMemberPermissions(permission)
    .addUserOption(o => o.setName('member').setDescription('Member to moderate').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the case').setMaxLength(400).setRequired(true));
  if (name === 'timeout') command.addIntegerOption(o => o.setName('minutes').setDescription('Timeout duration').setMinValue(1).setMaxValue(40320).setRequired(true));
  return command;
});
commands.push(
  new SlashCommandBuilder().setName('history').setDescription('Browse case history for a member').setDMPermission(false).setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption(o => o.setName('member').setDescription('Member').setRequired(true))
    .addIntegerOption(o => o.setName('page').setDescription('History page, newest first').setMinValue(1).setMaxValue(100000)),
  new SlashCommandBuilder().setName('case').setDescription('Look up a case').setDMPermission(false).setDefaultMemberPermissions(P.ModerateMembers)
    .addIntegerOption(o => o.setName('id').setDescription('Case number').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('mod-config').setDescription('Set or disable moderation logs').setDMPermission(false).setDefaultMemberPermissions(P.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('Log channel; omit to disable').addChannelTypes(ChannelType.GuildText)),
);
