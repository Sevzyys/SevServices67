console.log("Deploy command file is running");

require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const embedCommand = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Embed tools")
  .addSubcommand(subcommand =>
    subcommand
      .setName("build")
      .setDescription("Build a custom embed")
      .addStringOption(o => o.setName("title").setDescription("Embed title").setRequired(true))
      .addStringOption(o => o.setName("description").setDescription("Embed description").setRequired(true))
      .addStringOption(o => o.setName("footer").setDescription("Footer text").setRequired(false))
      .addStringOption(o => o.setName("footer_icon").setDescription("Footer icon URL").setRequired(false))
      .addStringOption(o => o.setName("author").setDescription("Author text").setRequired(false))
      .addStringOption(o => o.setName("author_icon").setDescription("Author icon URL").setRequired(false))
      .addStringOption(o => o.setName("url").setDescription("Title clickable URL").setRequired(false))
      .addStringOption(o => o.setName("thumbnail").setDescription("Thumbnail URL").setRequired(false))
      .addStringOption(o => o.setName("banner").setDescription("Bottom banner image URL").setRequired(false))
      .addBooleanOption(o => o.setName("timestamp").setDescription("Add timestamp?").setRequired(false))

      .addStringOption(o => o.setName("field1_name").setDescription("Field 1 title").setRequired(false))
      .addStringOption(o => o.setName("field1_value").setDescription("Field 1 description").setRequired(false))
      .addStringOption(o => o.setName("field2_name").setDescription("Field 2 title").setRequired(false))
      .addStringOption(o => o.setName("field2_value").setDescription("Field 2 description").setRequired(false))
      .addStringOption(o => o.setName("field3_name").setDescription("Field 3 title").setRequired(false))
      .addStringOption(o => o.setName("field3_value").setDescription("Field 3 description").setRequired(false))
      .addStringOption(o => o.setName("field4_name").setDescription("Field 4 title").setRequired(false))
      .addStringOption(o => o.setName("field4_value").setDescription("Field 4 description").setRequired(false))
      .addStringOption(o => o.setName("field5_name").setDescription("Field 5 title").setRequired(false))
      .addStringOption(o => o.setName("field5_value").setDescription("Field 5 description").setRequired(false))
      .addStringOption(o => o.setName("field6_name").setDescription("Field 6 title").setRequired(false))
      .addStringOption(o => o.setName("field6_value").setDescription("Field 6 description").setRequired(false))
  );

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the ticket panel"),

  embedCommand
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Deploying commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Commands deployed!");
  } catch (err) {
    console.error(err);
  }
})();