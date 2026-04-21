import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Stats
    const [
      totalClients,
      activeProjects,
      totalProjects,
      revenueThisMonth,
      revenueLastMonth,
      pendingPayments,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      clientsWithPayments,
    ] = await Promise.all([
      Client.countDocuments(),
      Project.countDocuments({ status: { $in: ["new", "in_progress"] } }),
      Project.countDocuments(),
      Invoice.aggregate([
        { $match: { status: "paid", createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        { $match: { status: "paid", createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        { $match: { status: { $in: ["unpaid", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.countDocuments({ status: "paid" }),
      Invoice.countDocuments({ status: "unpaid" }),
      Invoice.countDocuments({ status: "overdue" }),
      Client.find({}, { name: 1, paymentHistory: 1 }).lean(),
    ]);

    const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthKey = getMonthKey(now);
    const lastMonthKey = getMonthKey(startOfLastMonth);

    let clientRevenueThisMonth = 0;
    let clientRevenueLastMonth = 0;
    const clientMonthlyRevenueMap = new Map<string, number>();

    for (const client of clientsWithPayments) {
      for (const payment of client.paymentHistory || []) {
        const paidAt = new Date(payment.paidAt);
        const key = getMonthKey(paidAt);
        if (key === thisMonthKey) clientRevenueThisMonth += payment.amount || 0;
        if (key === lastMonthKey) clientRevenueLastMonth += payment.amount || 0;
        clientMonthlyRevenueMap.set(key, (clientMonthlyRevenueMap.get(key) || 0) + (payment.amount || 0));
      }
    }

    const revenueThisMonthVal = (revenueThisMonth[0]?.total || 0) + clientRevenueThisMonth;
    const revenueLastMonthVal = (revenueLastMonth[0]?.total || 0) + clientRevenueLastMonth;
    const pendingPaymentsVal = pendingPayments[0]?.total || 0;

    // Monthly revenue chart (last 6 months)
    const monthlyRevenue = await Invoice.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    // Project status distribution
    const projectStatus = await Project.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Recent activity
    const recentClients = await Client.find().sort({ createdAt: -1 }).limit(3).lean();
    const recentProjects = await Project.find()
      .populate("clientId", "name")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    const recentInvoices = await Invoice.find()
      .populate("clientId", "name")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const invoiceMonthlyRevenueMap = new Map<string, number>();
    for (const item of monthlyRevenue) {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      invoiceMonthlyRevenueMap.set(key, item.total || 0);
    }

    const mergedMonthlyRevenue = Array.from(new Set([...invoiceMonthlyRevenueMap.keys(), ...clientMonthlyRevenueMap.keys()]))
      .sort((a, b) => a.localeCompare(b))
      .slice(-6)
      .map((month) => ({
        month,
        revenue: (invoiceMonthlyRevenueMap.get(month) || 0) + (clientMonthlyRevenueMap.get(month) || 0),
      }));

    return NextResponse.json({
      stats: {
        totalClients,
        activeProjects,
        totalProjects,
        revenueThisMonth: revenueThisMonthVal,
        revenueLastMonth: revenueLastMonthVal,
        pendingPayments: pendingPaymentsVal,
        paidInvoices,
        unpaidInvoices,
        overdueInvoices,
      },
      charts: {
        monthlyRevenue: mergedMonthlyRevenue,
        projectStatus: projectStatus.map((p) => ({
          status: p._id,
          count: p.count,
        })),
      },
      recent: {
        clients: recentClients,
        projects: recentProjects,
        invoices: recentInvoices,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
