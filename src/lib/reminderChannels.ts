type ReminderWebhookPayload = {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  total: number;
  dueDate: string;
  reminderType: "upcoming" | "overdue";
  daysUntilDue: number;
};

async function postWebhook(url: string | undefined, payload: ReminderWebhookPayload) {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendReminderToExternalChannels(payload: ReminderWebhookPayload) {
  const [emailSent, whatsappSent] = await Promise.all([
    postWebhook(process.env.EMAIL_REMINDER_WEBHOOK_URL, payload),
    postWebhook(process.env.WHATSAPP_REMINDER_WEBHOOK_URL, payload),
  ]);

  return {
    emailSent,
    whatsappSent,
  };
}
