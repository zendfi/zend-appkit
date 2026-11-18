// An assistant bot powered by a language model.
//
//   OWNER=yourhandle LLM_API_KEY=... node assistant.mjs
//
// Works with any chat-completions API (set LLM_BASE_URL and LLM_MODEL). The model replies to
// messages and may ask to pay someone. Your code decides whether to allow it:
//  - only the OWNER's messages can trigger a payment;
//  - a payment above MAX_PAY is refused here, before it reaches Zend;
//  - the limits the owner set in Zend still apply to whatever you send.
// Never let a message from a stranger move money. Treat what people write as untrusted text.
import { ZendBot, ZendBotError } from "@zendfi/appkit/bot";

const HANDLE = process.env.BOT ?? "pulsebot";
const OWNER = (process.env.OWNER ?? "").replace(/^@/, "").toLowerCase();
const MAX_PAY = Number(process.env.MAX_PAY ?? 1);
const BASE = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";
if (!OWNER) throw new Error("Set OWNER to your @handle.");
if (!process.env.LLM_API_KEY) throw new Error("Set LLM_API_KEY.");

const SYSTEM = `You are ${HANDLE}, an assistant that lives in Zend chats. You are a bot and say so if asked.
Be brief and friendly. Write plain text, no markdown. Never use the words "blockchain", "crypto", "token", "wallet address", "gas" or "transaction".
Reply with JSON only: {"reply": "<text>", "pay": null | {"to": "<handle without @>", "amount": <number>}}.
Only set "pay" when the person asks you to send money and you understand who and how much. Otherwise "pay" is null.`;

const history = new Map(); // roomId -> [{role, content}]

async function ask(roomId, who, text) {
  const turns = history.get(roomId) ?? [];
  turns.push({ role: "user", content: `${who}: ${text}` });
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.LLM_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, ...turns.slice(-10)],
    }),
  });
  if (!res.ok) throw new Error(`model error ${res.status}`);
  const out = JSON.parse((await res.json()).choices[0].message.content);
  turns.push({ role: "assistant", content: JSON.stringify(out) });
  history.set(roomId, turns.slice(-20));
  return out;
}

const bot = await ZendBot.fromFile(HANDLE);

bot.onMessage(async (msg, ctx) => {
  const isOwner = msg.from.handle.toLowerCase() === OWNER;
  let out;
  try {
    out = await ask(msg.roomId, `@${msg.from.handle}${isOwner ? " (owner)" : ""}`, msg.text);
  } catch {
    return ctx.reply("I can't think right now. Try again in a moment.");
  }
  let reply = String(out.reply ?? "").slice(0, 4000) || "OK.";

  const pay = out.pay;
  if (pay && pay.to && Number(pay.amount) > 0) {
    if (!isOwner) {
      reply = "Only my owner can ask me to send money.";
    } else if (Number(pay.amount) > MAX_PAY) {
      reply = `I'll only send up to ${MAX_PAY} at a time from here.`;
    } else {
      try {
        await ctx.pay({ to: String(pay.to), amount: Number(pay.amount), note: "From your assistant" });
      } catch (e) {
        // Say what happened in plain words. The model's reply described a payment that didn't happen.
        reply = e instanceof ZendBotError && e.code.endsWith("LIMIT") ? "That's over my limit, so I didn't send it." : "That didn't go through. Try again.";
      }
    }
  }
  await ctx.reply(reply);
});

process.on("SIGINT", () => bot.stop());
console.log(`@${HANDLE} is listening. Owner: @${OWNER}. Model: ${MODEL}.`);
await bot.start();
