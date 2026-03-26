const { MessageCommandAdapter, parseMessageOptions } = require('../utils/MessageCommandAdapter');
const { checkInteractionPermission } = require('../utils/permissionChecker');
const logger = require('../utils/logger');

const PREFIX = process.env.COMMAND_PREFIX || '!';

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Ignore DMs and messages without the prefix
        if (message.author.id === message.client.user.id) return;
        if (!message.guild) return;
        if (!message.content.startsWith(PREFIX)) return;

        const content = message.content.slice(PREFIX.length).trim();
        if (!content) return;

        const spaceIndex = content.indexOf(' ');
        const commandName = (spaceIndex === -1 ? content : content.slice(0, spaceIndex)).toLowerCase();
        const argString = spaceIndex === -1 ? '' : content.slice(spaceIndex + 1).trim();

        const command = message.client.commands.get(commandName);
        if (!command) return; // Silently ignore unknown commands

        // Parse options from the argument string
        const parsed = parseMessageOptions(command.data, argString);
        if (!parsed.success) {
            await message.channel.send(parsed.error).catch(() => {});
            return;
        }

        const adapter = new MessageCommandAdapter(message, commandName, parsed.options);

        // Check permissions
        const hasPermission = await checkInteractionPermission(adapter);
        if (!hasPermission) return;

        try {
            await command.execute(adapter);
        } catch (error) {
            logger.error(`Error executing prefix command ${commandName}:`, error);
            const lang = message.client.defaultLanguage;
            const reply = { content: message.client.languageManager.get(lang, 'ERROR_COMMAND_EXECUTION') };
            if (adapter.deferred || adapter.replied) {
                await adapter.followUp(reply).catch(() => {});
            } else {
                await adapter.reply(reply).catch(() => {});
            }
        }
    },
};
