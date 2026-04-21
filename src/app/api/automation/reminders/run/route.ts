import { NextResponse } from "next/server";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Invoice from "@/models/Invoice";
import ReminderLog from "@/models/ReminderLog";
import { sendWebPushToRoles, sendWebPushToUsers } from "@/lib/webpush";
import { sendReminderToExternalChannels } from "@/lib/reminderChannels";

type ClientRecipient = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
};

function isAuthorized(sessionRole?: string, automationKey?: string | null) {
  if (sessionRole === "admin") return true;
  if (!automationKey) return false;
  return automationKey === process.env.AUTOMATION_RUN_KEY;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const automationKey = req.headers.get("x-automation-key");

    if (!isAuthorized(session?.user?.role, automationKey)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const daysAhead = Math.max(1, Math.min(Number(searchParams.get("daysAhead") || 3), 30));

    const today = startOfDay(new Date());
    const aheadDate = addDays(today, daysAhead);
    const reminderDateKey = today.toISOString().slice(0, 10);

    const invoices = await Invoice.find({
      dueDate: { $ne: null, $lte: aheadDate },
      status: { $ne: "paid" },
    })
      .populate("clientId", "name email phone")
      .select("_id invoiceNumber total dueDate status clientId")
      .lean();

    let sentCount = 0;
    let skippedCount = 0;

    for (const invoice of invoices) {
      const dueDate = invoice.dueDate ? startOfDay(new Date(invoice.dueDate)) : null;
      if (!dueDate) continue;

      const daysUntilDue = differenceInCalendarDays(dueDate, today);
      const reminderType = daysUntilDue < 0 ? "overdue" : "upcoming";

      const upsertResult = await ReminderLog.updateOne(
        { invoiceId: invoice._id, reminderType, reminderDateKey },
        {
          $setOnInsert: {
            invoiceId: invoice._id,
            reminderType,
            reminderDateKey,
            channels: [],
          },
        },
        { upsert: true }
      );

      if (!upsertResult.upsertedCount) {
        skippedCount += 1;
        continue;
      }

      const rawClient = invoice.clientId as unknown;
      const client: ClientRecipient | null =
        rawClient && typeof rawClient === "object"
          ? {
              _id: "_id" in rawClient ? String((rawClient as { _id?: unknown })._id ?? "") : undefined,
              name: "name" in rawClient ? String((rawClient as { name?: unknown }).name ?? "") : undefined,
              email: "email" in rawClient ? String((rawClient as { email?: unknown }).email ?? "") : undefined,
              phone: "phone" in rawClient ? String((rawClient as { phone?: unknown }).phone ?? "") : undefined,
            }
          : null;
      const dueText = dueDate.toISOString().slice(0, 10);

      await sendWebPushToRoles(
        ["admin", "developer", "sales"],
        {
          title: reminderType === "overdue" ? "Invoice Overdue" : "Invoice Due Reminder",
          body:
            reminderType === "overdue"
              ? `${invoice.invoiceNumber} is overdue by ${Math.abs(daysUntilDue)} day(s)`
              : `${invoice.invoiceNumber} is due in ${daysUntilDue} day(s)`,
          url: `/invoices/${invoice._id}`,
        }
      );

      if (client?._id) {
        await sendWebPushToUsers([String(client._id)], {
          title: reminderType === "overdue" ? "Payment Overdue" : "Payment Reminder",
          body:
            reminderType === "overdue"
              ? `${invoice.invoiceNumber} is overdue. Amount: ₹${invoice.total.toLocaleString("en-IN")}`
              : `${invoice.invoiceNumber} due on ${dueText}. Amount: ₹${invoice.total.toLocaleString("en-IN")}`,
          url: `/client/invoices/${invoice._id}`,
        });
      }

      const channels = await sendReminderToExternalChannels({
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        clientName: client?.name || "Client",
        clientEmail: client?.email,
        clientPhone: client?.phone,
        total: invoice.total,
        dueDate: dueText,
        reminderType,
        daysUntilDue,
      });

      await ReminderLog.updateOne(
        { invoiceId: invoice._id, reminderType, reminderDateKey },
        {
          $set: {
            channels: [
              "push",
              ...(channels.emailSent ? ["email"] : []),
              ...(channels.whatsappSent ? ["whatsapp"] : []),
            ],
          },
        }
      );

      sentCount += 1;
    }

    return NextResponse.json({
      success: true,
      processed: invoices.length,
      sent: sentCount,
      skipped: skippedCount,
      daysAhead,
    });
  } catch (error) {
    console.error("Run reminders error:", error);
    return NextResponse.json({ error: "Failed to run reminders" }, { status: 500 });
  }
}
