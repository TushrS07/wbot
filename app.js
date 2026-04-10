import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/* ---------------- HEALTH CHECK ---------------- */
app.get("/health", (req, res) => {
    res.status(200).json({ message: "Server is healthy" });
});

/* ---------------- WEBHOOK VERIFY (META) ---------------- */
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

/* ---------------- SEND MESSAGE FUNCTION ---------------- */
async function sendMessage(to, text) {
    const url = `https://graph.facebook.com/v${process.env.WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                text: { body: text }
            })
        });

        const data = await response.text();
        console.log("Send API response:", data);
        return { success: true, data };
    } catch (err) {
        console.error("Error sending message:", err);
        return { success: false, error: err.message };
    }
}

app.post("/send-message", async (req, res) => {
    const { to, text } = req.body;

    if (!to || !text) {
        return res.status(400).json({ error: "Missing 'to' or 'text' field" });
    }

    const result = await sendMessage(to, text);
    
    if (result.success) {
        res.status(200).json({ message: "Message sent successfully" });
    } else {
        res.status(500).json({ error: "Failed to send message", details: result.error });
    }
});


/* ---------------- WEBHOOK RECEIVE ---------------- */
app.post("/webhook", async (req, res) => {
    // respond FAST to Meta
    res.sendStatus(200);

    console.log("Webhook event:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            const msg = change.value?.messages?.[0];

            if (!msg) continue;

            const from = msg.from;
            const text = msg.text?.body;

            if (!text) continue;

            console.log(`Message from ${from}: ${text}`);

            // ---------------- AUTO REPLY ----------------
            try {
                const result = await sendMessage(from, "Hello I received your message");
                if (!result.success) {
                    console.error(`Failed to send auto-reply to ${from}:`, result.error);
                }
            } catch (err) {
                console.error(`Error sending auto-reply to ${from}:`, err);
            }
        }
    }
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});