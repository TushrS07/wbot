import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.get("/health", (req, res) => {
    res.status(200).send({ message: "Server is healthy" });
});

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post("/webhook", (req, res) => {
    console.log("Received webhook event:", req.body);
    const body = req.body;

    if (body.object === "whatsapp_business_account") {
        body.entry?.forEach((entry) => {
            entry.changes?.forEach((change) => {
                const value = change.value;
                const messages = value?.messages;

                if (messages && messages.length > 0) {
                    const msg = messages[0];
                    const from = msg.from;
                    const text = msg.text?.body;

                    console.log(`Message from ${from}: ${text}`);
                }
            });
        });

        return res.sendStatus(200);
    }
    return res.sendStatus(404);
});

app.listen(3000, () => console.log("Server running on port 3000"));