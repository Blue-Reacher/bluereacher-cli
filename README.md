# bluereacher-cli

Send iMessage from your terminal. A zero-dependency CLI for the [Blue Reacher](https://bluereacher.com) API.

- One command to send, check status, read conversations, and check capability
- Zero dependencies, runs on Node 18+
- No A2P registration required

Docs: https://docs.bluereacher.com  
OpenAPI: https://docs.bluereacher.com/openapi.json

## Run without installing

```bash
export BLUEREACHER_API_KEY=brk_test_your_key
npx bluereacher-cli send +13035550101 "Following up on your quote"
```

## Install

```bash
npm install -g bluereacher-cli
bluereacher --help
```

## Auth

The CLI reads your key from the `BLUEREACHER_API_KEY` environment variable. Use a test key (`brk_test_...`) to hit the simulator: request validation is identical, but no message is ever sent.

```bash
export BLUEREACHER_API_KEY=brk_test_your_key
```

Never hard-code a live key (`brk_live_...`); keep it in your shell environment or a secret manager.

## Commands

```
bluereacher send <to> <message>       Send an iMessage to an E.164 number
bluereacher status <message_id>       Delivery status of a queued or sent item
bluereacher conversations <phone>     Recent conversation history for a number
bluereacher contacts [search]         List contacts, optionally filtered
bluereacher capability <phone...>     iMessage vs SMS capability for numbers
bluereacher help                      Show help
bluereacher version                   Print the version
```

### Demo

```bash
# Set a test key so nothing is actually sent
export BLUEREACHER_API_KEY=brk_test_your_key

# Paced (drip) send, the default
bluereacher send +13035550101 "Hey, following up on your quote"
# -> Queued: sim_abc123 (mode: drip)
#    Track it: bluereacher status sim_abc123

# Instant send with a native effect
bluereacher send +13035550101 "You're confirmed" --instant --effect confetti

# Attach media
bluereacher send +13035550101 "Your receipt" --media https://example.com/receipt.pdf

# Check delivery
bluereacher status sim_abc123

# Read the thread
bluereacher conversations +13035550101

# Is this number on iMessage?
bluereacher capability +13035550101 +13035550102

# Raw JSON for scripting
bluereacher status sim_abc123 --json
```

## Options

| Option | Applies to | Meaning |
| --- | --- | --- |
| `--instant` | send | Dispatch now instead of the paced drip pipeline |
| `--effect <name>` | send | iMessage effect (instant only), e.g. `confetti` |
| `--media <url>` | send | Attach an https media URL (repeatable) |
| `--delay <minutes>` | send | Minutes to schedule a drip send out |
| `--json` | all | Print the raw JSON response |
| `--base-url <url>` | all | Override the API base URL |

## License

MIT. Copyright 2026 Sagency International LLC (Blue Reacher).
