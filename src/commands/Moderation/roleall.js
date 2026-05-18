import { PermissionsBitField } from "discord.js";

const allowedUsers = [
  "1135749292770992158",
  "SECOND_ID_HERE"
];

export default {
  name: "roleall",
  description: "Give a role to everyone",

  async execute(message, args) {

    const isAdmin = message.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    const isAllowedUser = allowedUsers.includes(message.author.id);

    if (!isAdmin && !isAllowedUser) {
      return message.reply("You cannot use this command.");
    }

    const role = message.mentions.roles.first();

    if (!role) {
      return message.reply("Usage: .roleall @role");
    }

    if (
      role.position >=
      message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "That role is higher than my highest role."
      );
    }

    await message.reply(`Giving ${role} to everyone...`);

    const members = await message.guild.members.fetch();

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

    message.channel.send(
      `Done. Added role to ${success} members. Failed: ${failed}`
    );
  },
};
