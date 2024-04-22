// DO NOT MESS WITH THE CODE IN THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING.
// DO NOT MESS WITH THE CODE IN THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING.
// DO NOT MESS WITH THE CODE IN THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING.
// DO NOT MESS WITH THE CODE IN THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING.
// DO NOT MESS WITH THE CODE IN THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING.

// READ PRIVACY DISCLAIMER







// Imports
const fs = require('fs');
const axios = require('axios');
const { pipeline } = require('stream');
const { OpusEncoder } = require('@discordjs/opus');
const { OpusHead, OggLogicalBitstream } = require('prism-media').opus;
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    ButtonBuilder,
    ActionRowBuilder, 
    ButtonStyle,
} = require('discord.js');
const { 
    joinVoiceChannel, 
    VoiceConnectionStatus,
    createAudioPlayer, 
    NoSubscriberBehavior,
    createAudioResource, 
} = require('@discordjs/voice');

// Listener bot client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences]
});


// Variables for running the bot
const [
    token,
    curveKey,
    voiceID,
    guildID,
    ensureConsent
] = process.argv.slice(2);

// Consent embed sent to newcomers
const consentEmbed = new EmbedBuilder()
    .setTitle('Voice moderation')
    .setFooter({ text: 'Powered by Curve', iconUrl: 'https://curvebot.xyz/static/Official.png' })
    .setColor('#4A9BFF')
    .setDescription('The voice channel is being recorded and actively moderated by a third-party service. To speak in this voice channel, you need to consent with the button below.')
    .addFields(
        { name: 'Why am I being recorded?', value: 'By using this service, it will reduce toxicity and other nuisances such as loud mics in voice channels and automatically moderate offenders 24/7 without needing human input.', inline: false },
        { name: 'Consent', value: 'By pressing the button below, I consent to being recorded, and my voice data being sent to a third-party service for moderation purposes.', inline: false },
);

// Sleep function since js doesnt come with one.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Sends voice data to curve servers
async function postData(url, oggFilePath, additionalData) {
    try {
        const oggFileBuffer = fs.readFileSync(oggFilePath);
        const formData = new FormData();
        const oggFileBlob = new Blob([oggFileBuffer], { type: 'audio/ogg' });
        formData.append('file', oggFileBlob, 'audio.ogg');
        formData.append('information', JSON.stringify(additionalData))
        const response = await axios.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// Communicates with the above function for sending audio files to curve servers
function upload_audio(userId, randomNumber) {
    const filePath = `recordings/${guildID}_${userId}_${randomNumber}.ogg`;
    const url = `https://curvebot.xyz/api/audio`
    const data = {
        authorization: curveKey,
        voice: voiceID,
        user: userId,
        guild: guildID
    }
    postData(url, filePath, data)
        .then(data => {
            //console.log('File uploaded successfully:', data);
        })
        .catch(error => {
            console.error('❌ File upload failed:', error);
        });
}

// Connect the bot to the specified channel
async function connectVoice() {
    try {
        const channel = await client.channels.fetch(voiceID);
        if (channel) {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guildID,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true,
                audioEncoder: {
                    type: 'opus',
                    opus: OpusEncoder,
                },
            });
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log("🔊 Connected to voice channel");
            });
            return connection;
        } else {
            console.error("❌ Voice channel not found");
            return null;
        }
    } catch (error) {
        console.error("❌ Error connecting to voice channel:", error);
        return null;
    }
}

// Runs when the bot is ready to use
client.once('ready', async () => {
    console.log(`🚪 Logged in as ${client.user.tag}`);

    // Set a custom presence
    client.user.setPresence({
        status: 'idle' // You can set the status to 'online', 'idle', 'dnd' (do not disturb), or 'invisible'
    });

    await connectVoice();
});

// Voice event for detecting when users speak, join or leave, etc.
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!newState.member || newState.member.user.bot) return;

        const channel = newState.guild.channels.cache.get(newState.channelId);
        if (!channel || !channel.guild) return;

        if (!oldState.channelId && newState.channelId) {
            user = client.users.cache.get(newState.member.id)
            console.log(`👋🏻 ${user.tag} Joined the voice channel`)
            if (ensureConsent) {
                console.log(`🔎 Asking ${user.tag} for consent to record`)
                const channel = newState.guild.channels.cache.get(newState.channelId);
                if (channel.id === voiceID) {
                    if (channel.permissionsFor(client.user).has(PermissionsBitField.Flags.MuteMembers)) {
                        newState.member.voice.setMute(true);
    
                        const consent = new ButtonBuilder()
                            .setCustomId('consentButton')
                            .setLabel('Consent to recording')
                            .setStyle(ButtonStyle.Primary)
    
                        const service = new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://curvebot.xyz/')
                            .setLabel('Curve (Third party service)')
    
                        const row = new ActionRowBuilder()
                            .addComponents(consent, service)
                        
                        newState.member.send({ embeds: [consentEmbed], components: [row] })
                            .catch(console.error);
                    } else {
                        console.warn(`❌ No permissions to mute members in ${channel.name}`);
                    }
                }
            }            
            const connection = await connectVoice();
            if (connection) {
                const receiver = connection.receiver;
                const randomNumber = Math.floor(Math.random() * (1 - 101)) + 1
                receiver.speaking.on('start', (userId) => {
                    user = client.users.cache.get(userId)
                    const oggStream = new OggLogicalBitstream({
                        opusHead: new OpusHead({
                            channelCount: 2,
                            sampleRate: 48000
                        }),
                    });
                    const filePath = `recordings/${guildID}_${userId}_${randomNumber}.ogg`;
                    const writeStream = fs.createWriteStream(filePath);
                    console.log(`👂 Started recording ${user.tag}`);
                    pipeline(receiver.subscribe(userId), oggStream, writeStream, (err) => {
                        console.log("Pipeline")
                        if (err) {
                            console.error(`❌ Error recording file ${filePath} - ${err.message}`);
                        } else {
                            console.log(`🧾 Recorded ${filePath}`);
                        }
                    });
                })

                receiver.speaking.on('end', async (userId) => {
                    user = client.users.cache.get(userId)
                    //await sleep(8000)
                    console.log(`⬆ Uploading audio data, ${user.tag}`);
                    upload_audio(userId, randomNumber)

                })
            }
        } else if (oldState.channelId && !newState.channelId) {
            // User left voice channel do nothing but cope
        }
    } catch (error) {
        console.error("❌ Error in voiceStateUpdate event:", error);
    }
});

// Respond to users consenting to being recorded
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'consentButton') {
        try {
            const guild = await client.guilds.fetch(guildID);
            const member = await guild.members.fetch(interaction.user.id);
            const user = client.users.cache.get(interaction.user.id)

            if (member && member.voice && member.voice.channel) {
                console.log(`🎤 ${user.tag} Consented to being recorded`)
                await member.voice.setMute(false);
                await interaction.reply({ content: 'You have been unmuted!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'You are not in a voice channel.', ephemeral: true });
            }
        } catch (error) {
            console.error('Error unmuting user:', error);
            await interaction.reply({ content: 'An error occurred. Please try again later.', ephemeral: true });
        }
    }
});



client.login(token);