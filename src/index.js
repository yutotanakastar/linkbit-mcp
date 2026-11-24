#!/usr/bin/env node
/**
 * MCP server for LinkBit.
 *
 * Env:
 *   APP_URL  - API origin, e.g. https://linkbit.live
 *   API_KEY  - slk_... key from the API Keys page
 *   APP_NAME - display name (default: LinkBit)
 */

const APP_URL = (process.env.APP_URL || "https://linkbit.live").replace(/\/$/, "");
const API_KEY = process.env.API_KEY || "";
const NAME = process.env.APP_NAME || "LinkBit";

const utmProps = {
  utm_source: { type: "string", description: "UTM source, e.g. newsletter. Added to the destination URL." },
  utm_medium: { type: "string", description: "UTM medium, e.g. email. Added to the destination URL." },
  utm_campaign: { type: "string", description: "UTM campaign name. Added to the destination URL." },
  utm_term: { type: "string", description: "UTM term (paid keyword). Added to the destination URL." },
  utm_content: { type: "string", description: "UTM content (ad or link variant). Added to the destination URL." },
};

const idProp = {
  type: "string",
  description: "Link id (UUID) as returned by shorten_url, shorten_urls or list_links.",
};

const tools = [
  {
    name: "shorten_url",
    description:
      "Create one short link on linkbit.live for a destination URL. Returns the short URL and the link id. Optional UTM fields are merged into the destination without overwriting utm_* params it already has; a #fragment is kept. Fails on an invalid or unsafe URL, a slug that is taken, or when the daily create limit is reached.",
    inputSchema: {
      type: "object",
      properties: {
        destination: { type: "string", description: "Full http(s) URL to redirect to." },
        slug: { type: "string", description: "Custom slug for the short URL. A random one is used when omitted." },
        note: { type: "string", description: "Private note for your own reference. Not shown to visitors." },
        ...utmProps,
      },
      required: ["destination"],
    },
    annotations: { title: "Shorten URL", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "shorten_urls",
    description:
      "Create several short links in one call. Each item follows the same rules as shorten_url. Items that fail do not stop the others: the response lists the created links and the errors separately.",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          description: "Links to create, one object per link.",
          items: {
            type: "object",
            properties: {
              destination: { type: "string", description: "Full http(s) URL to redirect to." },
              slug: { type: "string", description: "Custom slug. A random one is used when omitted." },
              ...utmProps,
            },
            required: ["destination"],
          },
        },
      },
      required: ["urls"],
    },
    annotations: { title: "Shorten URLs", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "list_links",
    description:
      "List all short links of the account that owns the API key, newest first, with their ids, slugs and destinations. Use it to find a link id for the other tools. Read-only.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "List links", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "update_link",
    description:
      "Change an existing link: its destination, slug, note, UTM fields or the disabled flag. Only the fields you pass are changed. Changing the slug changes the short URL, so old copies of it stop working.",
    inputSchema: {
      type: "object",
      properties: {
        id: idProp,
        destination: { type: "string", description: "New destination URL." },
        slug: { type: "string", description: "New slug. The short URL changes with it." },
        note: { type: "string", description: "New private note." },
        disabled: { type: "boolean", description: "true stops the redirect, false turns it back on." },
        ...utmProps,
      },
      required: ["id"],
    },
    annotations: { title: "Update link", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "disable_link",
    description:
      "Disable a short link so it no longer redirects. Pass disabled=false to re-enable. Destructive: visitors will get an error instead of the destination.",
    inputSchema: {
      type: "object",
      properties: {
        id: idProp,
        disabled: { type: "boolean", description: "Default true (disable). Pass false to re-enable the link." },
      },
      required: ["id"],
    },
    annotations: {
      title: "Disable link",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "delete_link",
    description: "Permanently delete a short link. This cannot be undone.",
    inputSchema: {
      type: "object",
      properties: { id: idProp },
      required: ["id"],
    },
    annotations: {
      title: "Delete link",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_qr",
    description:
      "Generate a QR code image that opens the short link. The image is returned as an image block. Read-only: it does not change the link.",
    inputSchema: {
      type: "object",
      properties: {
        id: idProp,
        format: { type: "string", enum: ["png", "svg"], description: "Image format. Defaults to png." },
        color: { type: "string", description: "Optional QR color." },
        logo: { type: "boolean", description: "Put the LinkBit logo in the center of the code." },
        print: { type: "boolean", description: "Use the print-oriented variant of the code." },
      },
      required: ["id"],
    },
    annotations: { title: "Get QR code", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "get_link_stats",
    description:
      "Click statistics for one link, with breakdowns by country, device, referrer and day. Optionally limit the date range. For all links at once use get_analytics. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        id: idProp,
        from: { type: "string", description: "Start date, YYYY-MM-DD." },
        to: { type: "string", description: "End date, YYYY-MM-DD." },
      },
      required: ["id"],
    },
    annotations: { title: "Link stats", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "get_analytics",
    description:
      "Analytics for the whole account across all links: total clicks, unique visitors, link count, top links, and breakdowns by day, country, device and referrer. For a single link use get_link_stats. Read-only.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "Analytics", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
];

async function api(path, options = {}) {
  const response = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "linkbit-mcp/1.0",
      ...(options.headers || {}),
    },
  });
  const type = response.headers.get("content-type") || "";
  if (type.includes("image/") || type.includes("svg")) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`API ${response.status}`);
    return {
      contentType: type,
      base64: buf.toString("base64"),
      bytes: buf.length,
    };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (data && Array.isArray(data.created) && Array.isArray(data.errors)) return data;
    const message = data.error || `API ${response.status}`;
    if (response.status === 401) {
      throw new Error(
        "401 Unauthorized: API_KEY is invalid. Create a key at https://linkbit.live/api-keys",
      );
    }
    throw new Error(message);
  }
  return data;
}

async function callTool(name, args = {}) {
  if (!API_KEY) {
    throw new Error(
      "API_KEY is not set. Create a key at https://linkbit.live/api-keys and set API_KEY to the slk_ value.",
    );
  }
  switch (name) {
    case "shorten_url":
      return api("/api/v1/links", { method: "POST", body: JSON.stringify(args) });
    case "shorten_urls":
      return api("/api/v1/links/bulk", { method: "POST", body: JSON.stringify(args) });
    case "list_links":
      return api("/api/v1/links");
    case "update_link": {
      const { id, ...body } = args;
      return api(`/api/v1/links/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    }
    case "disable_link":
      return api(`/api/v1/links/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: args.disabled !== false }),
      });
    case "delete_link":
      return api(`/api/v1/links/${args.id}`, { method: "DELETE" });
    case "get_qr": {
      const query = new URLSearchParams();
      query.set("format", args.format || "png");
      if (args.color) query.set("color", args.color);
      if (args.logo) query.set("logo", "1");
      if (args.print) query.set("print", "1");
      return api(`/api/v1/links/${args.id}/qr?${query}`);
    }
    case "get_link_stats": {
      const query = new URLSearchParams();
      if (args.from) query.set("from", args.from);
      if (args.to) query.set("to", args.to);
      const suffix = query.toString() ? `?${query}` : "";
      return api(`/api/v1/links/${args.id}/stats${suffix}`);
    }
    case "get_analytics":
      return api("/api/v1/analytics");
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id, message) {
  process.stdout.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } })}\n`,
  );
}

const SUPPORTED_PROTOCOL = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

async function handle(message) {
  const { id, method, params } = message;
  if (method === "initialize") {
    const requested = params?.protocolVersion;
    reply(id, {
      protocolVersion: SUPPORTED_PROTOCOL.has(requested) ? requested : "2025-03-26",
      capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
      serverInfo: { name: `${NAME} MCP`, version: "1.0.0" },
    });
    return;
  }
  if (method?.startsWith("notifications/")) return;
  if (method === "initialized") return;
  if (method === "tools/list") {
    reply(id, { tools });
    return;
  }
  if (method === "resources/list") {
    reply(id, { resources: [] });
    return;
  }
  if (method === "resources/templates/list") {
    reply(id, { resourceTemplates: [] });
    return;
  }
  if (method === "prompts/list") {
    reply(id, { prompts: [] });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    if (!tools.some((tool) => tool.name === name)) {
      fail(id, `Unknown tool ${name || ""}`.trim());
      return;
    }
    try {
      const result = await callTool(name, params.arguments || params.args || {});
      if (result && result.base64 && typeof result.contentType === "string") {
        const mime = result.contentType.split(";")[0].trim();
        const content = [];
        if (mime.startsWith("image/")) {
          content.push({ type: "image", data: result.base64, mimeType: mime });
        }
        content.push({
          type: "text",
          text: JSON.stringify({ contentType: result.contentType, bytes: result.bytes }, null, 2),
        });
        reply(id, { content });
        return;
      }
      reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (error) {
      reply(id, {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Tool failed",
          },
        ],
      });
    }
    return;
  }
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (id === undefined || id === null) return;
  fail(id, `Unknown method ${method}`);
}

function takeJsonMessages(chunk) {
  const messages = [];
  let rest = chunk;
  while (rest.length) {
    const headerMatch = rest.match(/^Content-Length:\s*(\d+)\r?\n\r?\n/i);
    if (headerMatch) {
      const size = Number(headerMatch[1]);
      const start = headerMatch[0].length;
      const body = rest.slice(start, start + size);
      if (body.length < size) break;
      messages.push(body);
      rest = rest.slice(start + size);
      continue;
    }
    const nl = rest.indexOf("\n");
    if (nl === -1) break;
    const line = rest.slice(0, nl).trim();
    rest = rest.slice(nl + 1);
    if (line) messages.push(line);
  }
  return { messages, rest };
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const { messages, rest } = takeJsonMessages(buffer);
  buffer = rest;
  for (const line of messages) {
    try {
      void handle(JSON.parse(line));
    } catch (error) {
      fail(null, error instanceof Error ? error.message : "Invalid JSON");
    }
  }
});
