require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal'); // We will use this to manually print the QR code
const axios = require('axios');

const PUSHOVER_USER_KEY = process.env.PUSHOVER_USER_KEY;
const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN;

// Safely parse the user keywords object, fallback to empty object if not configured
let userKeywords = {};
try {
    userKeywords = process.env.USER_KEYWORDS_JSON ? JSON.parse(process.env.USER_KEYWORDS_JSON) : {};
} catch (e) {
    console.error("Failed to parse USER_KEYWORDS_JSON from environment variables:", e.message);
}

async function sendPushoverAlert(sender, messageBody) {
    try {
        await axios.post('https://api.pushover.net/1/messages.json', {
            token: PUSHOVER_APP_TOKEN,
            user: PUSHOVER_USER_KEY,
            title: `EMERGENCY ALERT`,
            message: `From ${sender}: ${messageBody}`,
            priority: 2,          
            retry: 60,            
            expire: 300          
        });
        console.log("Critical alert forwarded to Pushover successfully.");
    } catch (error) {
        console.error("Failed to send Pushover alert:", error.message);
    }
}

async function startServer() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const sock = makeWASocket({
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n SCAN THIS QR CODE WITH WHATSAPP TO LOG IN:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            // Check if the connection closed because you logged out on your phone
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== 401;
            
            if (shouldReconnect) {
                console.log("Connection lost due to network glitch. Reconnecting in 5 seconds...");
                setTimeout(() => startServer(), 5000); // Gives the network a 5-second breather
            } else {
                console.log("You logged out from your phone. Delete 'auth_info' and restart to scan a new QR.");
            }
        } else if (connection === 'open') {
            console.log("Successfully connected to WhatsApp! Listening for keywords...");
        }
    });

    // Listen for incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        console.log(`[DEBUG] Event received! Type: ${m.type}, Message Count: ${m.messages?.length || 0}`);

        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            if (msg.messageStubType) continue;

            if (msg.key.fromMe) {
                console.log(`[DEBUG] Skipping: Message sent by yourself.`);
                continue;
            }

            const remoteJid = msg.key.remoteJid;
            
            const isStandardDM = remoteJid && (remoteJid.endsWith('@s.whatsapp.net') || remoteJid.endsWith('@lid'));
            
            if (!isStandardDM) {
                console.log(`[DEBUG] Skipping: Not a standard DM or LID account (${remoteJid})`);
                continue; 
            }

            const text = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || 
                         msg.message?.videoMessage?.caption || 
                         "";

            console.log(`[DEBUG] RAW MESSAGE DETECTED:
               - JID: "${remoteJid}"
               - Text content: "${text || '[No text content/Media message]'}"`);

            if (text) {
                console.log(`Processing DM text from ${remoteJid}: "${text}"`);

                // Splits "7493784407@s.whatsapp.net" or "139908677169205@lid" down to just the digits
                const rawId = remoteJid.split('@')[0]; 
                
                // Look up the keyword using either the full JID OR just the raw ID/phone number
                const targetKeywords = userKeywords[remoteJid] || userKeywords[rawId] || Object.keys(userKeywords).find(key => key.includes(rawId) ? userKeywords[key] : null);
                const keywordsArray = Array.isArray(targetKeywords) ? targetKeywords : (typeof targetKeywords === 'string' ? [targetKeywords] : null);
                console.log(`[DEBUG] Target Keywords configured for this user: ${keywordsArray ? JSON.stringify(keywordsArray) : 'NONE DEFINED'}`);
                if (keywordsArray) {
                    const upperText = text.toUpperCase();
                    
                    // Loop over the array elements to check if ANY of the words are included in the message
                    const matchedKeyword = keywordsArray.find(kw => upperText.includes(kw.toUpperCase()));

                    if (matchedKeyword) {
                        console.log(`Match found! Triggered by keyword: "${matchedKeyword}". Triggering alert...`);
                        await sendPushoverAlert(remoteJid, text, matchedKeyword);
                    } else {
                        console.log(`None of the keywords ${JSON.stringify(keywordsArray)} found in "${upperText}"`);
                    }
                }
            }
        }
    });
}

startServer();
