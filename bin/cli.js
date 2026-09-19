#!/usr/bin/env node
// Blue Reacher CLI: send iMessage from your terminal.
// Docs: https://docs.bluereacher.com
"use strict";

const VERSION = "0.1.0";
const BASE_URL = (process.env.BLUEREACHER_BASE_URL || "https://api.bluereacher.com/v1").replace(/\/+$/, "");

function printUsage() {
  console.log(`bluereacher ${VERSION} - send iMessage from your terminal

Usage:
  bluereacher <command> [options]

Commands:
  send <to> <message>       Send an iMessage to an E.164 number
  status <message_id>       Look up delivery status of a queued or sent item
  conversations <phone>     Print recent conversation history for a number
  contacts [search]         List contacts, optionally filtered by a search term
  capability <phone...>     Check iMessage vs SMS capability for numbers
  help                      Show this help
  version                   Print the CLI version

Send options:
  --instant                 Dispatch now instead of the paced drip pipeline
  --effect <name>           iMessage effect (instant only), e.g. confetti
  --media <url>             Attach an https media URL (repeatable)
  --delay <minutes>         Minutes to schedule a drip send out

Global options:
  --json                    Print the raw JSON response
  --base-url <url>          Override the API base URL

Auth:
  Reads your API key from the BLUEREACHER_API_KEY environment variable.
  Use a test key (brk_test_...) to hit the simulator: no message is sent.

Examples:
  export BLUEREACHER_API_KEY=brk_test_your_key
  bluereacher send +13035550101 "Following up on your quote"
  bluereacher send +13035550101 "You're confirmed" --instant --effect confetti
  bluereacher status sim_abc123
  bluereacher conversations +13035550101
  bluereacher capability +13035550101 +13035550102
`);
}

// Minimal flag parser. Returns { positionals, flags } where repeatable flags
// collect into arrays only for --media.
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  const repeatable = new Set(["media"]);
  const boolean = new Set(["instant", "json"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (boolean.has(name)) {
        flags[name] = true;
      } else {
        const value = argv[++i];
        if (repeatable.has(name)) {
          (flags[name] ||= []).push(value);
        } else {
          flags[name] = value;
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function requireKey() {
  const key = process.env.BLUEREACHER_API_KEY;
  if (!key) {
    console.error(
      "Error: set BLUEREACHER_API_KEY (a brk_live_ or brk_test_ key) first."
    );
    process.exit(1);
  }
  return key;
}

async function api(method, path, { query, body, baseUrl } = {}) {
  const key = requireKey();
  const url = new URL((baseUrl || BASE_URL) + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "User-Agent": "bluereacher-cli",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed with status ${res.status}`;
    console.error(`Error ${res.status}: ${msg}`);
    if (data && data.help) console.error(`Hint: ${data.help}`);
    process.exit(1);
  }
  return data;
}

function output(data, flags, human) {
  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (human) {
    human(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function cmdSend(positionals, flags) {
  const [to, message] = positionals;
  if (!to || (!message && !flags.media)) {
    console.error('Usage: bluereacher send <to> "<message>" [--instant] [--effect <name>] [--media <url>]');
    process.exit(1);
  }
  const body = { to };
  if (message) body.message = message;
  if (flags.media) body.media_urls = flags.media;
  if (flags.instant) body.send_mode = "instant";
  if (flags.effect) {
    body.send_mode = "instant";
    body.message_effect = flags.effect;
  }
  if (flags.delay) body.delay_minutes = Number(flags.delay);

  const data = await api("POST", "/messages", { body, baseUrl: flags["base-url"] });
  output(data, flags, (d) => {
    console.log(`Queued: ${d.message_id} (mode: ${d.mode})`);
    if (d.estimated_send_time) console.log(`Estimated send: ${d.estimated_send_time}`);
    if (d.status) console.log(`Status: ${d.status}`);
    console.log(`Track it: bluereacher status ${d.message_id}`);
  });
}

async function cmdStatus(positionals, flags) {
  const [id] = positionals;
  if (!id) {
    console.error("Usage: bluereacher status <message_id>");
    process.exit(1);
  }
  const data = await api("GET", `/status/${encodeURIComponent(id)}`, {
    baseUrl: flags["base-url"],
  });
  output(data, flags, (d) => {
    console.log(`Message: ${d.message_id}`);
    console.log(`Type:    ${d.type}`);
    console.log(`Status:  ${d.status}`);
    if (d.sent_at) console.log(`Sent at: ${d.sent_at}`);
    if (d.error) console.log(`Error:   ${d.error}`);
  });
}

async function cmdConversations(positionals, flags) {
  const [phone] = positionals;
  if (!phone) {
    console.error("Usage: bluereacher conversations <phone>");
    process.exit(1);
  }
  const data = await api("GET", "/conversations", {
    query: { phone, limit: flags.limit || 20 },
    baseUrl: flags["base-url"],
  });
  output(data, flags, (d) => {
    const messages = d.messages || [];
    if (messages.length === 0) {
      console.log("No messages.");
      return;
    }
    for (const m of messages) {
      const who = m.direction === "inbound" ? "<-" : "->";
      console.log(`${m.sent_at}  ${who}  ${m.message || "[" + m.type + "]"}`);
    }
  });
}

async function cmdContacts(positionals, flags) {
  const [search] = positionals;
  const data = await api("GET", "/contacts", {
    query: { search, per_page: flags.limit || 25 },
    baseUrl: flags["base-url"],
  });
  output(data, flags, (d) => {
    const contacts = d.contacts || [];
    if (contacts.length === 0) {
      console.log("No contacts.");
      return;
    }
    for (const c of contacts) {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)";
      console.log(`${c.phone_number}  ${name}`);
    }
    console.log(`\n${contacts.length} shown of ${d.total} total.`);
  });
}

async function cmdCapability(positionals, flags) {
  if (positionals.length === 0) {
    console.error("Usage: bluereacher capability <phone> [<phone> ...]");
    process.exit(1);
  }
  const data = await api("POST", "/capability", {
    body: { phones: positionals },
    baseUrl: flags["base-url"],
  });
  output(data, flags, (d) => {
    for (const r of d.results || []) {
      console.log(`${r.phone}  ${r.status}${r.confidence ? " (" + r.confidence + ")" : ""}`);
    }
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printUsage();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  const { positionals, flags } = parseArgs(argv.slice(1));

  switch (command) {
    case "send":
      return cmdSend(positionals, flags);
    case "status":
      return cmdStatus(positionals, flags);
    case "conversations":
      return cmdConversations(positionals, flags);
    case "contacts":
      return cmdContacts(positionals, flags);
    case "capability":
      return cmdCapability(positionals, flags);
    default:
      console.error(`Unknown command: ${command}\n`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
