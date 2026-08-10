/**
 * Outbound mailer for commitment follow-ups (T8).
 * POC: console + optional mailto via OWNER_NOTIFY_EMAIL. Swap implementation
 * without changing the sweep — the trigger (Actions / host cron) stays the same.
 */
export interface FollowUpEmail {
  to: string;
  subject: string;
  body: string;
  /** For logging / tests. */
  commitmentId: string;
  scheduledFor: string;
}

export interface Mailer {
  send(email: FollowUpEmail): Promise<void>;
}

/** Default: writes to stdout. Good enough until an SMTP provider is wired. */
export class ConsoleMailer implements Mailer {
  async send(email: FollowUpEmail): Promise<void> {
    console.log(
      JSON.stringify({
        type: "followup_email",
        to: email.to,
        subject: email.subject,
        commitmentId: email.commitmentId,
        scheduledFor: email.scheduledFor,
        body: email.body,
      }),
    );
  }
}

/** Records sends for tests; does not print. */
export class RecordingMailer implements Mailer {
  readonly sent: FollowUpEmail[] = [];
  async send(email: FollowUpEmail): Promise<void> {
    this.sent.push(email);
  }
}

export function createMailer(): Mailer {
  return new ConsoleMailer();
}
