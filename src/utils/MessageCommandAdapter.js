const { ApplicationCommandOptionType } = require('discord.js');

/**
 * Strips the `ephemeral` property from a reply payload,
 * since prefix commands are always public.
 */
function stripEphemeral(payload) {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object') {
        const { ephemeral, ...rest } = payload;
        return rest;
    }
    return payload;
}

/**
 * Minimal options resolver that mirrors the CommandInteractionOptionResolver API
 * used by slash commands. Backed by a simple Map<string, value>.
 */
class MessageOptionsResolver {
    constructor(options) {
        this._options = options; // Map<string, any>
    }

    getString(name) {
        const v = this._options.get(name);
        return v !== undefined ? v : null;
    }

    getInteger(name) {
        const v = this._options.get(name);
        return v !== undefined ? v : null;
    }

    getBoolean(name) {
        const v = this._options.get(name);
        return v !== undefined ? v : null;
    }
}

/**
 * Wraps a Discord Message to expose the same API surface that all command
 * files use from a CommandInteraction.
 */
class MessageCommandAdapter {
    constructor(message, commandName, parsedOptions) {
        this._message = message;
        this._commandName = commandName;
        this._options = new MessageOptionsResolver(parsedOptions);
        this._deferred = false;
        this._replied = false;
        this._editReplyMessage = null;
    }

    get client() { return this._message.client; }
    get guild() { return this._message.guild; }
    get member() { return this._message.member; }
    get user() { return this._message.author; }
    get channel() { return this._message.channel; }
    get commandName() { return this._commandName; }
    get deferred() { return this._deferred; }
    get replied() { return this._replied; }
    get options() { return this._options; }

    async reply(payload) {
        if (this._replied) {
            return this.followUp(payload);
        }
        this._replied = true;
        return this._message.channel.send(stripEphemeral(payload));
    }

    async deferReply() {
        this._deferred = true;
        this._replied = true;
        await this._message.channel.sendTyping().catch(() => {});
    }

    async editReply(payload) {
        const cleaned = stripEphemeral(payload);
        if (this._editReplyMessage) {
            return this._editReplyMessage.edit(cleaned);
        }
        this._editReplyMessage = await this._message.channel.send(cleaned);
        return this._editReplyMessage;
    }

    async followUp(payload) {
        return this._message.channel.send(stripEphemeral(payload));
    }
}

/**
 * Introspects a command's SlashCommandBuilder options and parses a raw
 * argument string into a Map that MessageOptionsResolver can use.
 *
 * Returns { success: true, options: Map } or { success: false, error: string }.
 */
function parseMessageOptions(commandData, argString) {
    const json = commandData.toJSON();
    const optionDefs = json.options || [];
    const result = new Map();

    if (!optionDefs.length) {
        return { success: true, options: result };
    }

    // Extract --flag tokens for boolean options
    const booleanDefs = optionDefs.filter(o => o.type === ApplicationCommandOptionType.Boolean);
    let remaining = argString;
    for (const def of booleanDefs) {
        const flagPattern = new RegExp(`(^|\\s)--${def.name}(\\s|$)`);
        if (flagPattern.test(remaining)) {
            result.set(def.name, true);
            remaining = remaining.replace(flagPattern, '$1').trim();
        }
    }

    // Split remaining into words
    const words = remaining ? remaining.split(/\s+/) : [];

    // Process integer options first (consume one word each)
    const integerDefs = optionDefs.filter(o => o.type === ApplicationCommandOptionType.Integer);
    for (const def of integerDefs) {
        if (!words.length) {
            if (def.required) {
                return { success: false, error: `Missing required option: \`${def.name}\`` };
            }
            continue;
        }
        const raw = words.shift();
        const num = parseInt(raw, 10);
        if (isNaN(num)) {
            return { success: false, error: `\`${raw}\` is not a valid number for \`${def.name}\`` };
        }
        if (def.min_value !== undefined && num < def.min_value) {
            return { success: false, error: `\`${def.name}\` must be at least ${def.min_value}` };
        }
        if (def.max_value !== undefined && num > def.max_value) {
            return { success: false, error: `\`${def.name}\` must be at most ${def.max_value}` };
        }
        result.set(def.name, num);
    }

    // Process string options last (greedy — join all remaining words)
    const stringDefs = optionDefs.filter(o => o.type === ApplicationCommandOptionType.String);
    for (const def of stringDefs) {
        if (!words.length) {
            if (def.required) {
                return { success: false, error: `Missing required option: \`${def.name}\`` };
            }
            continue;
        }
        // Greedy: consume all remaining words for the first string option
        result.set(def.name, words.join(' '));
        words.length = 0;
    }

    return { success: true, options: result };
}

module.exports = {
    MessageCommandAdapter,
    MessageOptionsResolver,
    parseMessageOptions,
};
