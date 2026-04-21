import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { startOfDay } from "date-fns";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";
import Invoice from "@/models/Invoice";
import User from "@/models/User";
import { addFrequency, computeProratedAmount } from "@/lib/billing";
import { sendWebPushToRoles } from "@/lib/webpush";

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

    const actorUser = session?.user?.id
      ? { _id: session.user.id, name: session.user.name || "Automation", role: session.user.role }
      : await User.findOne({ role: "admin" }).select("_id name role").lean();

    if (!actorUser?._id) {
      return NextResponse.json({ error: "No admin user found for invoice generation" }, { status: 400 });
    }

    const today = startOfDay(new Date());

    const clients = await Client.find({
      recurringPayments: {
        $elemMatch: {
          active: true,
          autoGenerateInvoice: true,
        },
      },
    }).lean();

    let generatedInvoices = 0;
    const updatedClients: string[] = [];

    for (const client of clients) {
      let clientChanged = false;

      for (let i = 0; i < (client.recurringPayments || []).length; i += 1) {
        const recurring = client.recurringPayments[i] as {
          _id: { toString(): string };
          label: string;
          amount: number;
          frequency: "monthly" | "quarterly" | "yearly";
          startDate: Date;
          endDate?: Date | null;
          nextDueDate: Date;
          active: boolean;
          paused?: boolean;
          autoGenerateInvoice?: boolean;
          prorationMode?: "none" | "daily";
          projectId?: { toString(): string } | null;
          lastGeneratedAt?: Date | null;
        };

        if (!recurring.active || recurring.paused || recurring.autoGenerateInvoice === false) continue;

        let dueCursor = startOfDay(new Date(recurring.nextDueDate));
        let iteration = 0;

        while (dueCursor <= today && iteration < 12) {
          const amount = computeProratedAmount(
            recurring.amount,
            dueCursor,
            recurring.frequency,
            recurring.prorationMode || "none",
            recurring.endDate ? new Date(recurring.endDate) : null
          );

          if (amount > 0) {
            const count = await Invoice.countDocuments();
            const invoiceNumber = `INV-${String(count + 1).padStart(4, "0")}`;

            await Invoice.create({
              invoiceNumber,
              clientId: client._id,
              projectId: recurring.projectId ? String(recurring.projectId) : null,
              invoiceDate: dueCursor,
              dueDate: dueCursor,
              items: [
                {
                  description: `${recurring.label} (${recurring.frequency})`,
                  quantity: 1,
                  rate: amount,
                  amount,
                },
              ],
              subtotal: amount,
              discount: 0,
              discountType: "fixed",
              gstEnabled: false,
              gstRate: 18,
              cgst: 0,
              sgst: 0,
              total: amount,
              status: "unpaid",
              workflowStatus: "approved",
              workflowHistory: [
                {
                  action: "approved",
                  actorId: String(actorUser._id),
                  actorName: actorUser.name || "Automation",
                  actorRole: actorUser.role || "admin",
                  note: "Auto-generated from recurring billing",
                  at: new Date(),
                },
              ],
              notes: `Auto-generated from recurring plan: ${recurring.label}`,
              createdBy: actorUser._id,
            });

            generatedInvoices += 1;
          }

          const nextDueDate = addFrequency(dueCursor, recurring.frequency);
          dueCursor = startOfDay(nextDueDate);

          (client.recurringPayments[i] as unknown as { nextDueDate: Date }).nextDueDate = dueCursor;
          (client.recurringPayments[i] as unknown as { lastGeneratedAt: Date }).lastGeneratedAt = new Date();

          if (recurring.endDate && dueCursor > startOfDay(new Date(recurring.endDate))) {
            (client.recurringPayments[i] as unknown as { active: boolean }).active = false;
          }

          clientChanged = true;
          iteration += 1;
        }
      }

      if (clientChanged) {
        await Client.updateOne({ _id: client._id }, { $set: { recurringPayments: client.recurringPayments } });
        updatedClients.push(String(client._id));
      }
    }

    if (generatedInvoices > 0) {
      await sendWebPushToRoles(["admin", "developer", "sales"], {
        title: "Recurring Invoices Generated",
        body: `${generatedInvoices} recurring invoice(s) were generated automatically`,
        url: "/invoices",
      });
    }

    return NextResponse.json({
      success: true,
      generatedInvoices,
      updatedClients,
    });
  } catch (error) {
    console.error("Recurring invoice generation error:", error);
    return NextResponse.json({ error: "Failed to generate recurring invoices" }, { status: 500 });
  }
}
