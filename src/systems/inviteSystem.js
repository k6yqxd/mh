import fs from "fs";

const DATA_FILE = "./invites.json";

const PREFIX = ".";
const LEADERBOARD_CHANNEL_ID = "IDE_A_LEADERBOARD_CHANNEL_ID";
const JOIN_LOG_CHANNEL_ID = "IDE_A_JOIN_LOG_CHANNEL_ID";

let inviteCache = new Map();
let cooldowns = new Map();
let commandMessages = new Map();

function loadData() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function addInvite(guildId, inviterId) {
  const data = loadData();

  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][inviterId]) data[guildId][inviterId] = 0;

  data[guildId][inviterId]++;
  saveData(data);
}

function getInvites(guildId, userId) {
  const data = loadData();
  return data[guildId]?.[userId] || 0;
}

function getLeaderboard(guildId) {
  const data = loadData();
  const guildData = data[guildId] || {};

  return Object.entries(guildData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function makeLeaderboardText(guild) {
  const lb = getLeaderboard(guild.id);

  let text = "╭・🏆 **INVITE TOPLISTA**\n│\n";

  if (!lb.length) {
    text += "╰・Még nincs invite.";
    return text;
  }

  lb.forEach(([userId, invites], index) => {
    text += `├ #${index + 1} <@${userId}> — **${invites}** invite\n`;
  });

  text += "│\n╰・🇭🇺 Hungarian Hood";

  return text;
}

async function updateLeaderboard(client) {
  const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID).catch(() => null);

  if (!channel || !channel.guild) return;

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);

  const oldMsg = messages?.find(
    msg =>
      msg.author.id === client.user.id &&
      msg.content.includes("INVITE TOPLISTA")
  );

  const text = makeLeaderboardText(channel.guild);

  if (oldMsg) {
    oldMsg.edit(text).catch(() => {});
  } else {
    channel.send(text).catch(() => {});
  }
}

async function punishSpam(message, userId) {
  const savedMessages = commandMessages.get(userId) || [];
  const lastThree = savedMessages.slice(-3);

  for (const msg of lastThree) {
    await msg.delete().catch(() => {});
  }

  await message.member.timeout(60_000, "Invite spam").catch(() => {});

  const warnMsg = await message.channel.send(
    `⚠️ <@${userId}> timeoutot kapott **1 percre** invite spam miatt.`
  ).catch(() => null);

  if (warnMsg) {
    setTimeout(() => {
      warnMsg.delete().catch(() => {});
    }, 5000);
  }
}

export async function setupInviteSystem(client) {
  client.once("ready", async () => {
    console.log("Invite rendszer betöltve.");

    for (const guild of client.guilds.cache.values()) {
      const invites = await guild.invites.fetch().catch(() => null);

      if (invites) {
        inviteCache.set(guild.id, invites);
      }
    }

    setInterval(() => {
      updateLeaderboard(client);
    }, 60_000);
  });

  client.on("inviteCreate", async invite => {
    const invites = await invite.guild.invites.fetch().catch(() => null);

    if (invites) {
      inviteCache.set(invite.guild.id, invites);
    }
  });

  client.on("inviteDelete", async invite => {
    const invites = await invite.guild.invites.fetch().catch(() => null);

    if (invites) {
      inviteCache.set(invite.guild.id, invites);
    }
  });

  client.on("guildMemberAdd", async member => {
    const oldInvites = inviteCache.get(member.guild.id);

    const newInvites = await member.guild.invites.fetch().catch(() => null);

    if (!oldInvites || !newInvites) return;

    const usedInvite = newInvites.find(invite => {
      const oldInvite = oldInvites.get(invite.code);

      return oldInvite && invite.uses > oldInvite.uses;
    });

    inviteCache.set(member.guild.id, newInvites);

    if (!usedInvite?.inviter) return;

    addInvite(member.guild.id, usedInvite.inviter.id);

    const totalInvites = getInvites(
      member.guild.id,
      usedInvite.inviter.id
    );

    const channel = member.guild.channels.cache.get(JOIN_LOG_CHANNEL_ID);

    if (channel) {
      channel.send({
        content:
`╭・🎉 **ÚJ TAG**
│
├ 👤 Felhasználó: <@${member.id}>
├ 📨 Meghívta: <@${usedInvite.inviter.id}>
├ 🏆 Invitejai: **${totalInvites}**
│
╰・🇭🇺 Üdv a Hungarian Hoodban`
      }).catch(() => {});
    }
  });

  client.on("messageCreate", async message => {
    if (message.author.bot || !message.guild) return;

    const command = message.content.toLowerCase();

    if (
      command !== `${PREFIX}invites` &&
      command !== `${PREFIX}invlb` &&
      command !== `${PREFIX}adminlb`
    ) return;

    const userId = message.author.id;
    const now = Date.now();

    if (!commandMessages.has(userId)) {
      commandMessages.set(userId, []);
    }

    commandMessages.get(userId).push(message);

    const oldCooldown = cooldowns.get(userId) || {
      lastUsed: 0,
      spamCount: 0
    };

    if (now - oldCooldown.lastUsed < 10_000) {
      oldCooldown.spamCount++;

      cooldowns.set(userId, oldCooldown);

      if (oldCooldown.spamCount >= 3) {
        await punishSpam(message, userId);

        cooldowns.set(userId, {
          lastUsed: now,
          spamCount: 0
        });

        return;
      }

      const reply = await message.reply(
        "⏳ Várj **10 másodpercet** mielőtt újra használod az invite parancsokat."
      ).catch(() => null);

      if (reply) {
        setTimeout(() => {
          reply.delete().catch(() => {});
        }, 4000);
      }

      return;
    }

    cooldowns.set(userId, {
      lastUsed: now,
      spamCount: 0
    });

    if (command === `${PREFIX}invites`) {
      const count = getInvites(message.guild.id, userId);

      return message.reply({
        content:
`╭・📨 **INVITEJAID**
│
├ 👤 Felhasználó: <@${userId}>
├ 🏆 Inviteok: **${count}**
│
╰・Hívj meg több embert a jutalmakért 🎁`
      });
    }

    if (command === `${PREFIX}invlb`) {
      return message.reply({
        content: makeLeaderboardText(message.guild)
      });
    }

    if (command === `${PREFIX}adminlb`) {
      if (!message.member.permissions.has("Administrator")) {
        return message.reply(
          "❌ Ezt a parancsot csak admin használhatja."
        );
      }

      await updateLeaderboard(message.client);

      return message.reply(
        "✅ Invite toplista elküldve / frissítve."
      );
    }
  });
}
