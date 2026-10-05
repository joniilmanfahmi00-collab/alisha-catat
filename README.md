# Alisha Catat: a local Gemma order assistant for a small print shop

A small, local-first order-taking app built for **Alisha Cetak**, a print shop in Cisontrol, Rancah (Indonesia). The owner types, speaks or fills in an order. A local **Gemma** model turns the free text into structured data, plain code prices it from the shop's own price list, and the app produces receipts and sales reports.

> Built for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01) (DEV x MLH).
> DEV post: [Alisha Catat: a local Gemma order assistant for a small print shop in Ciamis, Indonesia](https://dev.to/joni_ilman12/alisha-catat-a-local-gemma-order-assistant-for-a-small-print-shop-in-ciamis-indonesia-1cg8)
> Demo video: [DEMO](https://youtu.be/5HfD7Sn_3tU)

## Screenshots

<table>
  <tr>
    <td><img width="376" height="669" alt="brave_XdVAX5Hizv" src="https://github.com/user-attachments/assets/591574cf-2025-48cd-92c7-39610603a8e8" /></td>
    <td><img width="375" height="667" alt="brave_TgSRCOOykD" src="https://github.com/user-attachments/assets/23597838-3ccb-420c-a31c-2615c993842e" /></td>
    <td><img width="375" height="667" alt="brave_hEydZyixao" src="https://github.com/user-attachments/assets/95958486-fc41-4df5-bd42-8a4ab36098d3" /></td>
    <td><img width="375" height="667" alt="brave_z5DUQnjVdN" src="https://github.com/user-attachments/assets/72dc525e-7578-4977-a54d-ed20076e480e" /></td>
    <td><img width="375" height="667" alt="brave_OtdunzwdjD" src="https://github.com/user-attachments/assets/ad8790b9-767a-47d6-abae-55ccd7c62058" /></td>
  </tr>
</table>

## What it does

- **Order entry**: type or dictate an order, for example `Pak Dedi pesan spanduk 3x1 dua lembar, DP 100rb`, or use the manual form.
- **Local AI parsing**: `gemma3:4b` (through [Ollama](https://ollama.com)) extracts customer, items, size, quantity and unit. The output is constrained by a JSON schema.
- **Pricing from the shop's price list**: per unit, per m², per pack, and price ranges that the owner confirms by hand. Totals are computed in code with Decimal.js, never by the model.
- **Confirmation card**: the owner reviews and edits everything before saving. Missing or suspicious fields are highlighted.
- **Receipts**: PDF, Excel, or an image to share on WhatsApp.
- **Reports**: daily, weekly and monthly summaries with a chart, exportable to PDF and Excel.
- **Offline-friendly**: typing an order and parsing it need no internet connection.

## How it works

```text
browser (Vue) --> /api/parse (h3) --> Ollama --> Gemma 3 4B  (JSON, schema-constrained)
      |                 |
      |                 +-- guard code: normalise names and sizes, parse the DP amount with a regex,
      |                     drop invented customer names, flag items the model missed
      v
confirmation card --> /api/orders --> SQLite (Drizzle) --> receipts, reports
```

The model only extracts text. Everything involving money is deterministic code.

## Tech stack

- [Solid-Vue JS](https://docs.solid-vue.tech) (Vue 3 + Vite, file-based API routes on h3)
- Ollama + `gemma3:4b`
- SQLite + Drizzle ORM (`better-sqlite3`)
- Decimal.js, Tailwind CSS v4, Tabler icons, Chartist, pdf-lib, ExcelJS

## Run it locally

Requirements: Node.js 20.19+ (22.12+ recommended) and Ollama.

```powershell
ollama pull gemma3:4b
bun install
bun run dev            #You can run on your mobile by installing mkcert and add flag --host on your terminal
```

Open <http://localhost:5173>. The first request after starting can take 20-40 seconds while the model loads. The home page warms it up automatically.

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama is running |
| `OLLAMA_MODEL` | `gemma3:4b` | Which model to use |

The SQLite file is created on first run (see `src/server/db/client.ts`) and is git-ignored. **Do not commit real orders.**

## Measured performance (informal)

Five invented sample orders on an **AMD A8-9600, 8 GB RAM, no GPU**:

| Setup | Correct | Time per order |
|---|---|---|
| gemma3:4b, long prompt | 5/5 | ~37 s |
| gemma3:4b, short prompt | 5/5 | ~23 s |
| gemma3:1b, short prompt | 4/5 (the miss was flagged by a warning) | ~11 s |

On a CPU, reading the prompt cost more than writing the answer, so a shorter prompt plus guard code was the biggest win. This is not a rigorous benchmark.

## Privacy

No telemetry. Orders and customer names stay in the local SQLite file. Voice dictation uses the **browser's** speech recognition, which may be processed in the cloud by default. Parsing with Gemma is local.

## Known limitations

- Voice input needs a microphone and a secure context (HTTPS or `localhost`). Opening the app from a phone over a plain `http://192.168.x.x` address blocks the mic. Phone keyboard dictation still works.
- 20-40 seconds per order on low-end hardware. Faster machines will do better.
- Tested on a handful of orders so far.
- Some price-list lines are ambiguous (for example "per m"). They are modelled as the owner confirmed.

## Challenge notes

- **Window**: the project was started and completed during the challenge window (2 Oct 2026 02:00 UTC to 5 Oct 2026 06:59 UTC).
- **Prior work credited**: [Solid-Vue JS](https://github.com/solid-vue/solid-vue) and its CLI add-ons are the author's earlier framework, used here as a tool. The order assistant itself (AI parsing, pricing, receipts, reports) was built during the window.
- **AI assistance**: built with help from Claude and GitHub Copilot in VS Code. TODO: confirm the exact tools used.
- **Commits after the deadline** (after 5 Oct 2026 06:59 UTC): TODO list them here, or write "none".

## Acknowledgements

Thanks to A Asep, owner of Alisha Cetak, for trying it in the shop and for his permission to be named.

## License

MIT License
