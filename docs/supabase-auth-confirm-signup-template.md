# Supabase Confirmation Email Template

LedgerAI does not send the verification email from app code. The app only triggers Supabase Auth sign-up, and Supabase Dashboard sends the confirmation email using the template you configure there.

Use this as the production-ready `Confirm signup` template in **Supabase Dashboard -> Authentication -> Email Templates**.

## Subject

`Confirm your LedgerAI account`

## HTML

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:32px 36px 24px;background:#0f172a;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#93c5fd;font-weight:700;">
                  LedgerAI
                </div>
                <h1 style="margin:12px 0 10px;font-size:28px;line-height:1.2;color:#ffffff;">
                  Confirm your email
                </h1>
                <p style="margin:0;font-size:16px;line-height:1.6;color:#cbd5e1;">
                  One quick step to activate your LedgerAI account and keep your bookkeeping secure.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                  Hello,
                </p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                  Your LedgerAI workspace is ready. Confirm your email address to finish creating your account and return to your sign-up flow.
                </p>
                <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">
                  If you did not request this account, you can safely ignore this message.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:12px;background:#2563eb;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;font-size:15px;line-height:1;color:#ffffff;text-decoration:none;font-weight:700;">
                        Confirm email address
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#475569;">
                  Button not working? Paste this link into your browser:
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
                  <a href="{{ .ConfirmationURL }}" style="color:#2563eb;text-decoration:underline;">{{ .ConfirmationURL }}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  After confirmation, sign in to LedgerAI and continue in your cloud-backed workspace.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Plain text

```text
Confirm your LedgerAI account

Hello,

Your LedgerAI workspace is ready. Confirm your email address to finish creating your account and return to your sign-up flow.

Confirm your account here:
{{ .ConfirmationURL }}

If you did not request this account, you can safely ignore this message.

After confirmation, sign in to LedgerAI and continue in your cloud-backed workspace.
```

## Exact Supabase setup

1. Open **Supabase Dashboard -> Authentication -> Providers -> Email**.
2. Enable **Email/Password auth** and **email confirmations**.
3. Open **Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup**.
4. Paste the HTML template above into the message body.
5. Paste the plain-text version above into the text-only field if your project exposes one.
6. Set the subject to `Confirm your LedgerAI account`.
7. Make sure your **Site URL** and **Redirect URLs** cover the real web target you want confirmation links to return to.
8. Test with a brand-new email address and verify the link opens the intended app or web redirect.

## Current repo behavior

- Web sign-up already sends Supabase an `emailRedirectTo` based on the current browser origin in [`src/RootApp.jsx`](/Users/akshaychouhan/ledgerai/src/RootApp.jsx).
- Mobile sign-up currently relies on Supabase defaults in [`apps/mobile/src/features/auth/hooks/useAuthSession.ts`](/Users/akshaychouhan/ledgerai/apps/mobile/src/features/auth/hooks/useAuthSession.ts), so the confirmation flow will follow the project Site URL unless mobile redirect handling is added later.
