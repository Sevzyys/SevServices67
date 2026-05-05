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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ✅ ANTI-DUPE SYSTEM
const recentlyWelcomed = new Set();

async function updateMemberCount(guild) {
  const channel = guild.channels.cache.get(process.env.MEMBER_COUNT_CHANNEL_ID);
  if (!channel) return;

  await channel.setName(`Members: ${guild.memberCount}`).catch(console.error);
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await updateMemberCount(guild);
  }
});

// ================= WELCOME + AUTO ROLE =================
client.on(Events.GuildMemberAdd, async member => {

  // 🚫 PREVENT DUPLICATE MESSAGES
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

      return interaction.editReply({
        content: "Panel sent."
      });
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

        if (footer) {
          embed.setFooter({
            text: footer,
            iconURL: footerIcon || undefined
          });
        }

        if (author) {
          embed.setAuthor({
            name: author,
            iconURL: authorIcon || undefined
          });
        }

        if (timestamp) embed.setTimestamp();

        for (let i = 1; i <= 6; i++) {
          const name = interaction.options.getString(`field${i}_name`);
          const value = interaction.options.getString(`field${i}_value`)?.replace(/\\n/g, "\n");

          if (name && value) {
            embed.addFields({ name, value, inline: false });
          }
        }

        await interaction.channel.send({
          embeds: [embed]
        });

        return interaction.editReply({
          content: "Embed sent."
        });
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
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim_ticket").setLabel("👤 Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Close").setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${member}`,
        components: [buttons]
      });

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
        content: `Claimed by ${interaction.user}`
      });
    }

    if (interaction.customId === "close_ticket") {
      return interaction.reply({
        content: "Are you sure?",
        flags: 64
      });
    }
  }
});

client.login(process.env.TOKEN);