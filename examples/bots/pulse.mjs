// Pulse: a small command bot. No model needed.
//
//   zend bot create "Pulse" --handle pulsebot --scopes read,dm_send,post_card,send_money,receive_money
//   OWNER=yourhandle node pulse.mjs
//
// Chat with it: help, balance, tip @name 0.25, post <text>, anything else gets a friendly line.
// Only OWNER can spend or post. Everyone else can chat. The owner's limits still apply to spending.
import { ZendBot, ZendBotError } from "@zendfi/appkit/bot";

const HANDLE = process.env.BOT ?? "pulsebot";
const OWNER = (process.env.OWNER ?? "").replace(/^@/, "").toLowerCase();
if (!OWNER) throw new Error("Set OWNER to your @handle, so only you can spend or post.");

const bot = await ZendBot.fromFile(HANDLE);
const stats = { chats: new Set(), messages: 0, paid: 0, tips: 0 };

const say = (code) =>
  ({
    OVER_PAYMENT_LIMIT: "That's more than I'm allowed to send in one payment.",
    OVER_DAILY_LIMIT: "That would go over my limit for the day.",
    RECIPIENT_NOT_ALLOWED: "I'm not allowed to pay that person.",
    SUI_ADDRESS_BALANCE_INSUFFICIENT: "I don't have enough spendable balance. Say \"deposit\" and try again.",
    RECIPIENT_NOT_FOUND: "I can't find that @handle.",
    USER_BLOCKED: "I can't pay that account.",
  })[code] ?? "That didn't go through. Try again.";

bot.onMessage(async (msg, ctx) => {
  const isOwner = msg.from.handle.toLowerCase() === OWNER;
  const text = msg.text.trim();
  const [cmd, ...args] = text.split(/\s+/);
  stats.chats.add(msg.roomId);
  stats.messages += 1;

  switch (cmd.toLowerCase()) {
    case "help":
      return ctx.reply(
        isOwner
          ? "I can do: balance, deposit, tip @name 0.25, post <text>, stats. Anyone can say hi."
          : "Hi! I'm Pulse, a bot. I'm marked Automated. Say hi, or ask for help.",
      );
    case "balance": {
      if (!isOwner) return ctx.reply("Only my owner can see that.");
      const b = await bot.balance();
      return ctx.reply(`I can spend ${b.spendable.amount}. Waiting to be made spendable: ${b.awaiting_deposit.amount}.`);
    }
    case "deposit": {
      if (!isOwner) return ctx.reply("Only my owner can do that.");
      await bot.deposit();
      return ctx.reply("Done. Check my balance in a moment.");
    }
    case "tip": {
      if (!isOwner) return ctx.reply("Only my owner can ask me to pay people.");
      const to = (args[0] ?? "").replace(/^@/, "");
      const amount = Number(args[1]);
      if (!to || !(amount > 0)) return ctx.reply("Try: tip @name 0.25");
      try {
        await bot.pay({ to, amount, note: "From Pulse" });
        stats.paid += amount;
        stats.tips += 1;
        return ctx.reply(`Sent ${amount} to @${to}.`);
      } catch (e) {
        return ctx.reply(say(e instanceof ZendBotError ? e.code : ""));
      }
    }
    case "post": {
      if (!isOwner) return ctx.reply("Only my owner can ask me to post.");
      const body = args.join(" ");
      if (!body) return ctx.reply("Try: post <what to say>");
      try {
        await bot.post(body, `post:${msg.id}`);
        return ctx.reply("Posted.");
      } catch (e) {
        return ctx.reply(e instanceof ZendBotError && e.code === "PLAIN_LANGUAGE" ? e.message : "That didn't go through. Try again.");
      }
    }
    case "stats":
      return ctx.reply(`${stats.messages} messages from ${stats.chats.size} chats. ${stats.tips} tips, ${stats.paid.toFixed(2)} sent.`);
    default:
      return ctx.reply(/^(hi|hey|hello|yo)\b/i.test(text) ? "Hey! Pulse here. I'm a bot. Say help." : "I only know a few words. Say help.");
  }
});

// A short note to the people who follow the bot's work, once a day.
setInterval(
  () => bot.post(`Pulse today: ${stats.messages} messages, ${stats.tips} tips sent.`, `daily:${new Date().toISOString().slice(0, 10)}`).catch(() => {}),
  24 * 60 * 60 * 1000,
);

process.on("SIGINT", () => bot.stop());
console.log(`@${HANDLE} is listening. Owner: @${OWNER}.`);
await bot.start();
