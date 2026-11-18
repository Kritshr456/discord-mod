export async function notifyModerationResult(interaction, result, channelId) {
  const { id, action, target, reason } = result;
  const reply = async () => {
    try { await interaction.editReply(`Case #${id}: ${action} recorded.`); }
    catch { console.error(`Case ${id}: private reply failed; case remains saved.`); }
  };
  const log = async () => {
    if (!channelId) return;
    try {
      const channel = await interaction.guild.channels.fetch(channelId);
      await channel.send({
        content: `Case #${id} • ${action} • <@${target}> • moderator <@${interaction.user.id}>\n${reason}`,
        allowedMentions: { parse: [] },
      });
    } catch { console.error(`Case ${id}: log delivery failed; case remains saved.`); }
  };
  await Promise.all([reply(), log()]);
}
