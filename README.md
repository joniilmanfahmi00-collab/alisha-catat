# Alisha Catat

Alisha Catat is a lightweight order and sales management application designed for a printing shop. It helps staff record customer orders quickly, review the details before saving, export receipts, and monitor daily, weekly, and monthly sales performance.

The project is built with Vue 3, Vite, TypeScript, and a local SQLite database. It also includes AI-assisted order parsing through Ollama, making it easier to convert handwritten or spoken order notes into structured entries.

## Features

- Order entry from typed text or microphone input
- AI-assisted parsing of printing orders using Ollama
- Manual review and editing before saving
- Structured customer, item, quantity, size, and down-payment data
- Automatic receipt numbering and order lookup
- PDF export for invoices and reports
- Excel export for reporting
- Daily, weekly, and monthly sales summaries
- WhatsApp-friendly sharing flow for invoices
- Product catalog with price ranges for easier manual entry

## Tech stack

- Solid-Vue JS 
- TypeScript
- Tailwind CSS
- Drizzle ORM
- better-sqlite3
- PDF and spreadsheet generation libraries
- Ollama for local AI parsing

## Requirements

Before running the project, ensure you have the following installed:

- Node.js 20 or newer
- npm
- Ollama (for AI order parsing)

The application will fall back to manual entry if the AI service is unavailable, but the parsing flow is designed to work best with Ollama running locally.

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd alisha-cetak
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start Ollama locally if you want AI parsing enabled:

   ```bash
   ollama serve
   ```

   If needed, pull the default model used by the application:

   ```bash
   ollama pull gemma3:4b
   ```

## Environment configuration

The application uses the following environment variables if you need to override the defaults:

```bash
OLLAMA_MODEL=gemma3:4b
OLLAMA_URL=http://localhost:11434
```

These values are optional, as the project already provides sensible defaults.

## Running the application

Run the development server:

```bash
npm run dev
```

Then open the app in your browser, typically at:

```text
http://localhost:5173
```

## Production build

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Available scripts

```bash
npm run dev
npm run build
npm run preview
npm run deploy
```

## How the app works

### Home screen

The home page allows staff to paste or dictate an order message. The system attempts to convert the text into structured order data, including:

- customer name
- item type
- size
- quantity
- unit
- down payment

The generated draft can then be reviewed and edited before saving.

### Nota screen

The Nota page allows users to look up an order by its reference number, download a PDF receipt, export to Excel, or prepare a WhatsApp message with the receipt image.

### Laporan screen

The Laporan page provides a summary of sales by day, week, or month and includes:

- total sales
- incoming down payments
- outstanding balances
- transaction count
- export to PDF and Excel

## Project structure

```text
src/
  components/
  layouts/
  lib/
  pages/
  server/
    api/
    db/
    utils/
  styles/
  App.vue
  main.ts
public/
index.html
package.json
vite.config.ts
tsconfig.json
```

## Notes

- The system stores financial amounts as integer rupiah values.
- The application is intended for local or small-scale operational use, rather than a multi-user cloud deployment out of the box.
- AI parsing is a convenience layer and should still be checked before finalising an order.

## Licence

No explicit licence file has been included in this repository, so usage and distribution should be confirmed with the project owner before publishing or sharing the code externally.
