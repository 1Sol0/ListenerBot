// Run this file to run all or just one bot.
// Run this file to run all or just one bot.
// Run this file to run all or just one bot.
// Run this file to run all or just one bot.
// Run this file to run all or just one bot.

// READ PRIVACY DISCLAIMER

const { spawn } = require('child_process');
const fs = require('fs').promises;

async function runBot(token, config) {
    const args = [
        token,
        config.curve_api_key,
        config.voice_channel_id,
        config.guild_id,
        config.ensure_consent
    ];
    
    return new Promise((resolve, reject) => {
        const child = spawn('node', ['curve_listener.js', ...args]);

        child.on('close', (code) => {
            console.log(`[${token}] Exited with code ${code}`);
            resolve();
        });

    });
}

async function runAllBots() {
    const configFile = 'settings.json';

    try {
        const configData = await fs.readFile(configFile, 'utf8');
        const config = JSON.parse(configData);

        const promises = Object.entries(config).map(([token, botConfig]) => runBot(token, botConfig));
        await Promise.all(promises);

        console.log('All listener bots have finished running.');
    } catch (error) {
        console.error('Error running bots:', error);
    }
}

runAllBots();