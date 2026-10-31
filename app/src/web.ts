import { NextFunction, Request, Response } from "express";

// Configuration comes entirely from the environment (12-factor). App Service
// sets these as app settings - see 5-app-service.tf.
export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`the environment variable ${name} must be set`);
  }
  return value;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderList(rows: [string, string][]): string {
  return `<dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(v)}</code></dd>`).join("")}</dl>`;
}

export function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; }
    .flow { color: #555; }
    .notice { background: #eef7ee; border: 1px solid #9c9; padding: 0.5rem 0.75rem; }
    .warning { background: #fdf6e3; border: 1px solid #cb9; padding: 0.5rem 0.75rem; }
    .error { background: #fbeeee; border: 1px solid #c99; padding: 0.5rem 0.75rem; overflow-wrap: anywhere; }
    section { margin-top: 2rem; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; }
    dt { color: #666; }
    dd { margin: 0; overflow-wrap: anywhere; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// Express 4 doesn't forward rejected promises from async handlers, so route
// any error to the error handler.
type AsyncHandler = (req: Request, res: Response) => Promise<void>;
export const handle = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(500).send("Internal Server Error");
}
