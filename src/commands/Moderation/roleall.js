import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("roleall")
    .setDescription("Give a role to everyone")
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("Role to give")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {

    const role = interaction.options.getRole("role");

    if (
      role.position >=
      interaction.guild.members.me.roles.highest.position
    ) {
      return interaction.reply({
        content: "That role is above my highest role.",
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `Giving ${role} to everyone...`,
      ephemeral: true,
    });

    const members =
      await interaction.guild.members.fetch();

    let success = 0;
    let failed = 0;

    for (const member of members.values()) {

      if (member.user.bot) continue;

      if (member.roles.cache.has(role.id)) continue;

      try {
        await member.roles.add(role);
        success++;

      } catch {
        failed++;
      }
    }

    await interaction.followUp({
      content:
        `Done.\n` +
        `Success: ${success}\n` +
        `Failed: ${failed}`,
      ephemeral: true,
    });
  },
};
