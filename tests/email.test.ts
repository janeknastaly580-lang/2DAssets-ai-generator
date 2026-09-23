import { describe, it, expect, vi } from "vitest";

type SendPayload = {
  from: string;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  template?: { id: string; variables: Record<string, string | number> };
};

const sent: SendPayload[] = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: SendPayload) => {
        sent.push(payload);
        return { data: { id: "test-id" }, error: null };
      },
    };
  },
}));

process.env.RESEND_API_KEY = "re_test_key";
process.env.EMAIL_FROM = "Veyraflow <website@veyraflow.eu>";
process.env.APP_URL = "http://localhost:3000";
process.env.SUPPORT_EMAIL = "support@veyraflow.eu";

/** SPEC §20.3 — aliases without a Resend template are rendered and sent inline. */
describe("sendTemplateEmail", () => {
  it("sends template-backed aliases through the Resend template", async () => {
    const { sendTemplateEmail, TEMPLATE_IDS } = await import("@/lib/email/resend");
    sent.length = 0;
    await sendTemplateEmail({ to: "a@example.com", alias: "signin", variables: { CODE: "482913" } });
    expect(sent[0].template?.id).toBe(TEMPLATE_IDS.signin);
    expect(sent[0].template?.variables).toEqual({ CODE: "482913" });
    expect(sent[0].html).toBeUndefined();
    expect(sent[0].from).toBe("Veyraflow <website@veyraflow.eu>");
  });

  it("sends the template-less aliases as inline HTML", async () => {
    const { sendTemplateEmail } = await import("@/lib/email/resend");
    sent.length = 0;
    await sendTemplateEmail({ to: "a@example.com", alias: "account-deleted", variables: {} });
    expect(sent[0].template).toBeUndefined();
    expect(sent[0].subject).toBe("Your Veyraflow account has been deleted");
    expect(sent[0].html).toContain("permanently deleted");
    expect(sent[0].text).toContain("support@veyraflow.eu");
  });

  it("escapes user-supplied values and rejects non-http links", async () => {
    const { sendTemplateEmail } = await import("@/lib/email/resend");
    sent.length = 0;
    await sendTemplateEmail({
      to: "a@example.com",
      alias: "job-completed",
      variables: { ASSET_NAME: 'Goblin "scout" <img src=x onerror=alert(1)>', ASSET_URL: "javascript:alert(1)" },
    });
    expect(sent[0].html).not.toContain("<img");
    expect(sent[0].html).not.toContain("javascript:");
    expect(sent[0].html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(sent[0].html).toContain('href="http://localhost:3000"');
  });
});
