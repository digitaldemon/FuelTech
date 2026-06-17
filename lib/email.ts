import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendCredentialsEmail(opts: {
  to: string;
  username: string;
  password: string;
  expiresAt: string;
  consoleKey?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, username, password, expiresAt, consoleKey } = opts;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { ok: false, error: "SMTP_USER or SMTP_PASS env var not set" };
  }

  try {
    await transporter.sendMail({
      from: "FuelTech AI Pro <info@fueltechaipro.com>",
      to,
      subject: "Your FuelTech AI Pro Login Credentials",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FuelTech AI Pro — Your Login Credentials</title>
</head>
<body style="margin:0;padding:0;background:#020617;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f172a;border:1px solid rgba(255,255,255,0.09);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0e2433 0%,#0f172a 100%);padding:32px 36px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <div style="width:48px;height:48px;background:#0f172a;border-radius:12px;border:1px solid rgba(34,211,238,0.25);">
                      <img src="https://www.fueltechaipro.com/icon-192.png" alt="FuelTech AI Pro" width="44" height="44" style="border-radius:10px;display:block;" />
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:18px;font-weight:700;color:#e2e8f0;line-height:1.2;">FuelTech AI Pro</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">AI for fueling technicians</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#e2e8f0;">Your account is ready.</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.6;">
                Welcome to FuelTech AI Pro. Your login credentials are below — save these somewhere safe.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.18);border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#475569;margin-bottom:4px;">Username</div>
                          <div style="font-size:18px;font-weight:700;color:#22d3ee;font-family:'Courier New',Courier,monospace;letter-spacing:0.04em;">${username}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:14px;${consoleKey ? 'padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">
                          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#475569;margin-bottom:4px;">Password</div>
                          <div style="font-size:18px;font-weight:700;color:#22d3ee;font-family:'Courier New',Courier,monospace;letter-spacing:0.04em;">${password}</div>
                        </td>
                      </tr>
                      ${consoleKey ? `<tr>
                        <td style="padding-top:14px;">
                          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#475569;margin-bottom:4px;">Console App License Key</div>
                          <div style="font-size:16px;font-weight:700;color:#22d3ee;font-family:'Courier New',Courier,monospace;letter-spacing:0.08em;">${consoleKey}</div>
                          <div style="font-size:11px;color:#475569;margin-top:6px;">Enter this in the FuelTech AI Console Connect desktop app on first launch.</div>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA buttons -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:${consoleKey ? '16px' : '28px'};">
                <tr>
                  <td style="background:#22d3ee;border-radius:10px;">
                    <a href="https://www.fueltechaipro.com/login" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:700;color:#020617;text-decoration:none;border-radius:10px;">
                      Sign in to FuelTech AI Pro →
                    </a>
                  </td>
                </tr>
              </table>
              ${consoleKey ? `<table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);border-radius:10px;">
                    <a href="https://www.fueltechaipro.com/api/download" style="display:inline-block;padding:11px 28px;font-size:14px;font-weight:700;color:#22d3ee;text-decoration:none;border-radius:10px;">
                      ↓ Download Console Connect (Windows)
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding-bottom:8px;">
                          <span style="color:#94a3b8;font-weight:600;">Access expires:</span>&nbsp; ${expiresAt}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#64748b;">
                          <span style="color:#94a3b8;font-weight:600;">Login URL:</span>&nbsp;
                          <a href="https://www.fueltechaipro.com/login" style="color:#22d3ee;text-decoration:none;">fueltechaipro.com/login</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                Questions? Reply to this email or contact us at
                <a href="mailto:info@fueltechaipro.com" style="color:#22d3ee;text-decoration:none;">info@fueltechaipro.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:#334155;line-height:1.6;">
                © 2026 Gen X Data Acquisitions LLC · FuelTech AI Pro™ ·
                <a href="https://www.fueltechaipro.com" style="color:#475569;text-decoration:none;">fueltechaipro.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
    });

    console.log("[email] Sent OK to:", to);
    return { ok: true };
  } catch (e) {
    console.error("[email] SMTP error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed" };
  }
}
