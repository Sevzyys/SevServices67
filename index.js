require("dotenv").config();
const discordTranscripts = require("discord-html-transcripts");

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  Events
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const recentlyWelcomed = new Set();
const warnings = new Map();
const ticketActivity = new Map();

const TICKET_WARNING_TIME = 48 * 60 * 60 * 1000; // 48 hours
const TICKET_CLOSE_TIME = 72 * 60 * 60 * 1000; // 72 hours

function isTicketChannel(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildText &&
    ["purchase-", "help-", "questions-"].some(prefix => channel.name.startsWith(prefix))
  );
}

function resetTicketTimer(channel, userId) {
  if (!isTicketChannel(channel)) return;

  const existing = ticketActivity.get(channel.id);

  if (existing) {
    clearTimeout(existing.warnTimeout);
    clearTimeout(existing.closeTimeout);
  }

  const warnTimeout = setTimeout(async () => {
    const ticket = channel.guild.channels.cache.get(channel.id);
    if (!ticket) return;

    await ticket.send({
      content: `<@${userId}> this ticket will close in **24 hours** due to inactivity. Send a message here to keep it open.`
    }).catch(console.error);
  }, TICKET_WARNING_TIME);

  const closeTimeout = setTimeout(async () => {
    const ticket = channel.guild.channels.cache.get(channel.id);
    if (!ticket) return;

    const logChannel = ticket.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

    await ticket.send({
      content: "Closing ticket due to 3 days of inactivity..."
    }).catch(() => {});

    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("⏰ Ticket Auto-Closed")
        .setColor("#4F3E84")
        .setDescription(
          `**Channel:** #${ticket.name}\n` +
          "**Reason:** 3 days of inactivity"
        )
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
    }

    setTimeout(() => {
      ticket.delete().catch(console.error);
    }, 5000);
  }, TICKET_CLOSE_TIME);

  ticketActivity.set(channel.id, {
    userId,
    warnTimeout,
    closeTimeout
  });
}
async function updateMemberCount(guild) {
  const channel = guild.channels.cache.get(process.env.MEMBER_COUNT_CHANNEL_ID);
  if (!channel) return;

  await channel.setName(`Members: ${guild.memberCount}`).catch(console.error);
}

const blockedPatterns = [
  /discord\.gg\/\S+/i,
  /discord\.com\/invite\/\S+/i,
  /dsc\.gg\/\S+/i,
  /free\s+nitro/i,
  /steam\s+gift/i,
  /claim\s+reward/i,
  /click\s+here/i,
  /cheap\s+prices/i,
  /buy\s+from\s+me/i,
  /dm\s+me/i,
  /join\s+my\s+server/i,
  /telegram/i,
  /whatsapp/i,
  /crypto\s+investment/i,
  /bit\.ly\/\S+/i,
  /tinyurl\.com\/\S+/i
];

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await updateMemberCount(guild);
  }
});

// ================= SECURITY SYSTEM =================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
if (isTicketChannel(message.channel)) {
  resetTicketTimer(message.channel, message.author.id);
}
  if (message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) return;

  const detected = blockedPatterns.some(pattern => pattern.test(message.content));
  if (!detected) return;

  await message.delete().catch(() => {});

  const currentWarnings = warnings.get(message.author.id) || 0;
  const newWarnings = currentWarnings + 1;
  warnings.set(message.author.id, newWarnings);

  await message.channel.send({
    content: `${message.author}, warning **${newWarnings}/3**. Promotions, scam links, and advertising are not allowed.`
  });

  const logChannel = message.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setTitle("🚨 Security Detection")
      .setColor("#4F3E84")
      .setDescription(
        `**User:** ${message.author}\n` +
        `**Warnings:** ${newWarnings}/3\n` +
        `**Channel:** ${message.channel}\n\n` +
        `**Message:**\n${message.content}`
      )
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
  }

  if (newWarnings >= 3) {
    await message.member.kick("Reached 3 auto-moderation warnings").catch(() => {});

    if (logChannel) {
      await logChannel.send({
        content: `👢 ${message.author} was kicked for reaching 3 security warnings.`
      });
    }
  }
});

// ================= WELCOME + AUTO ROLE =================
client.on(Events.GuildMemberAdd, async member => {
  if (recentlyWelcomed.has(member.id)) return;

  recentlyWelcomed.add(member.id);

  setTimeout(() => {
    recentlyWelcomed.delete(member.id);
  }, 60000);

  try {
    const welcomeChannel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
    const memberRole = member.guild.roles.cache.get(process.env.MEMBER_ROLE_ID);

    if (memberRole) {
      await member.roles.add(memberRole).catch(console.error);
    }

    await updateMemberCount(member.guild);

    const welcomeEmbed = new EmbedBuilder()
      .setTitle("💜 Welcome to Sev Services")
      .setDescription(
        `Welcome ${member}!\n\n` +
        "We’re glad to have you here.\n\n" +
        "Use the ticket panel if you need support, have questions, or want to make a purchase."
      )
      .setColor("#4F3E84")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage("https://media.discordapp.net/attachments/1339915824273559634/1389881488589459477/standard_8.gif")
      .addFields({
        name: "👥 Members",
        value: `You are member **#${member.guild.memberCount}**`,
        inline: true
      })
      .setFooter({ text: "Sev Services" })
      .setTimestamp();

    if (welcomeChannel) {
      await welcomeChannel.send({
        content: `${member}`,
        embeds: [welcomeEmbed]
      });
    }

    const dmEmbed = new EmbedBuilder()
      .setTitle("💜 Welcome to Sev Services")
      .setDescription(
        `Hey **${member.user.username}**, thanks for joining **Sev Services**!\n\n` +
        "Need help, have questions, or want to purchase? Open a ticket in the server and staff will assist you."
      )
      .setColor("#4F3E84")
      .setThumbnail(member.guild.iconURL())
      .setImage("https://media.discordapp.net/attachments/1339915824273559634/1389881488589459477/standard_8.gif")
      .setFooter({ text: "Sev Services" })
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] }).catch(() => {
      console.log(`Could not DM ${member.user.tag}`);
    });

  } catch (err) {
    console.error("Welcome system error:", err);
  }
});

client.on(Events.GuildMemberRemove, async member => {
  await updateMemberCount(member.guild);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {

    // ================= PANEL =================
    if (interaction.commandName === "panel") {
      await interaction.deferReply({ flags: 64 });

      const embed = new EmbedBuilder()
        .setTitle("💜 Support & Purchase System")
        .setDescription(
          "**Welcome to Sev Services.**\n\n" +
          "Please choose an option below to open a ticket.\n\n" +
          "🛒 **Purchase** — Buy products/services\n" +
          "🛠️ **Help** — Get support\n" +
          "❓ **Questions** — Ask before buying\n\n" +
          "*Our team will assist you shortly.*"
        )
        .setColor("#4F3E84")
        .setThumbnail("https://cdn.discordapp.com/attachments/1499585079796830208/1500153869206818987/standard_1.gif")
        .setImage("https://media.discordapp.net/attachments/1339915824273559634/1389881488589459477/standard_8.gif")
        .setFooter({ text: "Please do not open multiple tickets." });

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_menu")
        .setPlaceholder("Select a ticket reason")
        .addOptions(
          { label: "Purchase", value: "purchase" },
          { label: "Help", value: "help" },
          { label: "Questions", value: "questions" }
        );

      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.editReply({ content: "Panel sent." });
    }

    // ================= EMBED BUILDER =================
    if (interaction.commandName === "embed") {
      await interaction.deferReply({ flags: 64 });

      const sub = interaction.options.getSubcommand();

      if (sub === "build") {
        const defaultThumbnail =
          "https://cdn.discordapp.com/attachments/1499585079796830208/1500153869206818987/standard_1.gif";

        const defaultBanner =
          "https://media.discordapp.net/attachments/1339915824273559634/1389881488589459477/standard_8.gif";

        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description")?.replace(/\\n/g, "\n");
        const footer = interaction.options.getString("footer");
        const footerIcon = interaction.options.getString("footer_icon");
        const author = interaction.options.getString("author");
        const authorIcon = interaction.options.getString("author_icon");
        const url = interaction.options.getString("url");
        const thumbnail = interaction.options.getString("thumbnail") || defaultThumbnail;
        const banner = interaction.options.getString("banner") || defaultBanner;
        const timestamp = interaction.options.getBoolean("timestamp");

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(0x4F3E84)
          .setThumbnail(thumbnail)
          .setImage(banner);

        if (url) embed.setURL(url);
        if (footer) embed.setFooter({ text: footer, iconURL: footerIcon || undefined });
        if (author) embed.setAuthor({ name: author, iconURL: authorIcon || undefined });
        if (timestamp) embed.setTimestamp();

        for (let i = 1; i <= 6; i++) {
          const name = interaction.options.getString(`field${i}_name`);
          const value = interaction.options.getString(`field${i}_value`)?.replace(/\\n/g, "\n");

          if (name && value) {
            embed.addFields({ name, value, inline: false });
          }
        }

        await interaction.channel.send({ embeds: [embed] });
        return interaction.editReply({ content: "Embed sent." });
      }
    }
  }

  // ================= DROPDOWN =================
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_menu") {
      const type = interaction.values[0];
      const guild = interaction.guild;
      const member = interaction.member;

      const existing = guild.channels.cache.find(
        c => c.name.endsWith(`-${interaction.user.username}`)
      );

      if (existing) {
        return interaction.reply({
          content: `You already have a ticket: ${existing}`,
          flags: 64
        });
      }

      const channel = await guild.channels.create({
        name: `${type}-${member.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ]
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim_ticket")
          .setLabel("👤 Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("🔒 Close")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${member}`,
        components: [buttons]
      });
      resetTicketTimer(channel, member.id);

      return interaction.reply({
        content: `Ticket created: ${channel}`,
        flags: 64
      });
    }
  }

  // ================= BUTTONS =================
  if (interaction.isButton()) {

    if (interaction.customId === "claim_ticket") {
      return interaction.reply({
        content: `👤 Claimed by ${interaction.user}`
      });
    }

    if (interaction.customId === "close_ticket") {
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_close_ticket")
          .setLabel("Yes, close ticket")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("cancel_close_ticket")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "Are you sure you want to close this ticket?",
        components: [confirmRow],
        flags: 64
      });
    }

    if (interaction.customId === "cancel_close_ticket") {
      return interaction.update({
        content: "Ticket close cancelled.",
        components: []
      });
    }

    if (interaction.customId === "confirm_close_ticket") {
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);

      await interaction.update({
        content: "Creating transcript and closing ticket...",
        components: []
      });

      if (logChannel) {
        const transcript = await discordTranscripts.createTranscript(interaction.channel, {
          limit: -1,
          returnBuffer: false,
          filename: `${interaction.channel.name}-transcript.html`
        });

        const logEmbed = new EmbedBuilder()
          .setTitle("🔒 Ticket Closed")
          .setColor("#4F3E84")
          .setDescription(
            `**Closed By:** ${interaction.user}\n` +
            `**Channel:** #${interaction.channel.name}\n\n` +
            "Transcript attached below."
          )
          .setTimestamp();

        await logChannel.send({
          embeds: [logEmbed],
          files: [transcript]
        });
      }
const existingTimer = ticketActivity.get(interaction.channel.id);
if (existingTimer) {
  clearTimeout(existingTimer.warnTimeout);
  clearTimeout(existingTimer.closeTimeout);
  ticketActivity.delete(interaction.channel.id);
}
      setTimeout(() => {
        interaction.channel.delete().catch(console.error);
      }, 3000);
    }
  }
});

client.login(process.env.TOKEN);