import "server-only";
import { Resend } from "resend";
import { env, integrations } from "@/lib/env";

/** Aliases backed by a published template in the Resend account (SPEC §20.1). */
export type ResendTemplateAlias =
  | "signin"
  | "preset"
  | "workspace-invite"
  | "assets-expiring"
  | "moderation-warning"
  | "account-banned"
  | "data-export-ready";

/**
 * Aliases with no Resend template — the HTML is built here and sent inline (SPEC §20.3).
 * The `JOB_COMPLETED` and `ACCOUNT_DELETION_SCHEDULED` templates were deleted from the Resend
 * account on 2026-09-22 and are deliberately not recreated. `account-deleted` replaced the
 * scheduled-deletion mail when the 14-day grace period was dropped (SPEC §21.5).
 */
export type InlineAlias = "job-completed" | "account-deleted";

export type TemplateAlias = ResendTemplateAlias | InlineAlias;

/** Template IDs in the Resend account (SPEC §20). Aliases are also accepted by the API; IDs are used for safety. */
export const TEMPLATE_IDS: Record<ResendTemplateAlias, string> = {
  signin: "ad5b3d0d-f857-46b4-a686-c28b0c0922d7",
  preset: "ef77dfd1-10aa-4155-8991-1db794a03851",
  "workspace-invite": "472fe15b-54f1-4324-a3f1-53f27ca5a788",
  "assets-expiring": "9efcb43e-3330-4ceb-8292-ec8f718f840d",
  "moderation-warning": "111f76ff-d1db-434b-a2a7-c9f6b0334c41",
  "account-banned": "e0841686-2fa9-4072-bee8-90df24220102",
  "data-export-ready": "bd66db68-46c1-4138-b9a4-b6cdc9d5eaac",
};

export const TEMPLATE_VARIABLES: Record<TemplateAlias, string[]> = {
  signin: ["CODE"],
  preset: ["PRESET"],
  "workspace-invite": ["INVITER_NAME", "WORKSPACE_NAME", "INVITE_URL"],
  "assets-expiring": ["COUNT", "EXPIRES_AT", "LIBRARY_URL"],
  "moderation-warning": ["COUNT", "LIMIT"],
  "account-banned": ["REASON", "CONTACT_EMAIL"],
  "data-export-ready": ["DOWNLOAD_URL"],
  "job-completed": ["ASSET_NAME", "ASSET_URL"],
  "account-deleted": [],
};

function isInline(alias: TemplateAlias): alias is InlineAlias {
  return alias === "job-completed" || alias === "account-deleted";
}

/* ------------------------------------------------------------------ *
 * Inline e-mails — same visual language as the Resend templates.
 * ------------------------------------------------------------------ */

type Vars = Record<string, string | number>;

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only http(s) links reach the markup; anything else degrades to the app root. */
function safeUrl(value: string | number | undefined): string {
  const raw = String(value ?? "");
  return /^https?:\/\//i.test(raw) ? esc(raw) : esc(env.APP_URL);
}

interface Layout {
  eyebrow: string;
  heading: string;
  /** Paragraph HTML — every interpolated value must already be escaped. */
  paragraphs: string[];
  button?: { label: string; url: string };
  footerNote: string;
}

const SANS = "font-family:Arial,Helvetica,sans-serif;";

function renderLayout(l: Layout): string {
  const paragraphs = l.paragraphs
    .map(
      (p) =>
        `<tr><td style="${SANS}font-size:15px;line-height:24px;color:#a9a9bb;padding-top:0;padding-right:0;padding-bottom:16px;padding-left:0;">${p}</td></tr>`,
    )
    .join("\n");
  const button = l.button
    ? `<tr><td style="padding-top:12px;padding-right:0;padding-bottom:12px;padding-left:0;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#7C5CFF" style="background-color:#7C5CFF;border-top-left-radius:10px;border-top-right-radius:10px;border-bottom-right-radius:10px;border-bottom-left-radius:10px;"><a href="${l.button.url}" style="display:inline-block;${SANS}font-size:15px;line-height:22px;color:#ffffff;text-decoration:none;font-weight:bold;padding-top:13px;padding-right:26px;padding-bottom:13px;padding-left:26px;">${esc(l.button.label)}</a></td></tr></table></td></tr>
<tr><td style="${SANS}font-size:12px;line-height:19px;color:#6d6d80;padding-top:4px;padding-right:0;padding-bottom:16px;padding-left:0;">If the button does not work, copy this link into your browser:<br>${l.button.url}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<title>${esc(l.heading)}</title>
</head>
<body style="margin:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;background-color:#0b0b0f;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0b0f" style="background-color:#0b0b0f;">
<tr>
<td align="center" style="padding-top:40px;padding-right:16px;padding-bottom:40px;padding-left:16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:560px;">
<tr>
<td align="left" style="padding-top:0;padding-right:4px;padding-bottom:20px;padding-left:4px;${SANS}font-size:19px;line-height:24px;color:#ffffff;font-weight:bold;letter-spacing:0.4px;">Veyraflow<span style="color:#7C5CFF;">.</span></td>
</tr>
<tr>
<td bgcolor="#7C5CFF" height="3" style="background-color:#7C5CFF;font-size:0;line-height:3px;height:3px;border-top-left-radius:14px;border-top-right-radius:14px;">&nbsp;</td>
</tr>
<tr>
<td bgcolor="#15151c" style="background-color:#15151c;border-bottom-left-radius:14px;border-bottom-right-radius:14px;padding-top:36px;padding-right:32px;padding-bottom:32px;padding-left:32px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="${SANS}font-size:11px;line-height:16px;color:#7C5CFF;font-weight:bold;letter-spacing:1.4px;padding-top:0;padding-right:0;padding-bottom:10px;padding-left:0;">${esc(l.eyebrow)}</td>
</tr>
<tr>
<td style="${SANS}font-size:24px;line-height:32px;color:#ffffff;font-weight:bold;padding-top:0;padding-right:0;padding-bottom:12px;padding-left:0;">${esc(l.heading)}</td>
</tr>
${paragraphs}
${button}
<tr>
<td bgcolor="#26262f" height="1" style="background-color:#26262f;font-size:0;line-height:1px;height:1px;">&nbsp;</td>
</tr>
<tr>
<td style="${SANS}font-size:13px;line-height:20px;color:#76768a;padding-top:20px;padding-right:0;padding-bottom:0;padding-left:0;">${l.footerNote}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="${SANS}font-size:12px;line-height:18px;color:#5c5c6e;padding-top:24px;padding-right:8px;padding-bottom:0;padding-left:8px;">Veyraflow &middot; AI game asset generation &middot; <a href="https://veyraflow.eu" style="color:#8a8a9e;text-decoration:underline;">veyraflow.eu</a></td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&mdash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function renderText(l: Layout): string {
  const lines = ["Veyraflow", "", l.eyebrow, l.heading, "", ...l.paragraphs.map(stripTags), ""];
  if (l.button) lines.push(`${l.button.label}: ${stripTags(l.button.url)}`, "");
  lines.push(stripTags(l.footerNote), "", "Veyraflow - AI game asset generation - https://veyraflow.eu");
  return lines.join("\n");
}

const INLINE_EMAILS: Record<InlineAlias, (v: Vars) => { subject: string; layout: Layout }> = {
  "job-completed": (v) => ({
    subject: "Your asset is ready",
    layout: {
      eyebrow: "GENERATION COMPLETE",
      heading: "Your asset is ready",
      paragraphs: [
        `<strong style="color:#ffffff;">${esc(v.ASSET_NAME ?? "Your asset")}</strong> has finished generating and is waiting in your library.`,
      ],
      button: { label: "Open asset", url: safeUrl(v.ASSET_URL) },
      footerNote:
        "You are receiving this because job completion e-mails are enabled in your Veyraflow notification settings. You can turn them off at any time.",
    },
  }),
  "account-deleted": () => ({
    subject: "Your Veyraflow account has been deleted",
    layout: {
      eyebrow: "ACCOUNT DELETED",
      heading: "Your account has been deleted",
      paragraphs: [
        "Your Veyraflow account, your personal workspace and every file in it have been permanently deleted. Nothing was kept and nothing can be restored.",
        "Any active subscription was cancelled with the deletion. You can sign up again at any time with the same e-mail address, starting from scratch.",
      ],
      footerNote: `If you did not do this, contact us immediately at ${esc(env.SUPPORT_EMAIL)}.`,
    },
  }),
};

let client: Resend | null = null;
function resend() {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export interface SendTemplateOptions {
  to: string;
  alias: TemplateAlias;
  variables: Vars;
}

/**
 * Sends a Veyraflow e-mail by alias — through a published Resend template, or, for the aliases
 * in `INLINE_EMAILS`, with HTML built here. Without RESEND_API_KEY (local dev) the payload is
 * logged to the server console instead — codes can be read from the terminal.
 */
export async function sendTemplateEmail(opts: SendTemplateOptions): Promise<{ id: string | null }> {
  if (!integrations.resend) {
    console.info(`[email:dev] to=${opts.to} template=${opts.alias} vars=${JSON.stringify(opts.variables)}`);
    return { id: null };
  }

  if (isInline(opts.alias)) {
    const { subject, layout } = INLINE_EMAILS[opts.alias](opts.variables);
    const { data, error } = await resend().emails.send({
      from: env.EMAIL_FROM,
      to: opts.to,
      subject,
      html: renderLayout(layout),
      text: renderText(layout),
    });
    if (error) {
      throw new Error(`Resend error: ${error.name}: ${error.message}`);
    }
    return { id: data?.id ?? null };
  }

  const { data, error } = await resend().emails.send({
    from: env.EMAIL_FROM,
    to: opts.to,
    template: { id: TEMPLATE_IDS[opts.alias], variables: opts.variables },
  });
  if (error) {
    throw new Error(`Resend error: ${error.name}: ${error.message}`);
  }
  return { id: data?.id ?? null };
}
