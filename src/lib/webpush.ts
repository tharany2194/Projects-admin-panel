import webpush from "web-push";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";

const isConfigured = { value: false };

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function ensureWebPushConfigured() {
  if (isConfigured.value) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contactEmail = process.env.WEB_PUSH_CONTACT_EMAIL || "support@crowfy.com";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey);
  isConfigured.value = true;
  return true;
}

export async function sendWebPushToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureWebPushConfigured()) return;
  if (userIds.length === 0) return;

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const subscriptions = await PushSubscription.find({ userId: { $in: uniqueIds } }).lean();
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || "/notifications",
          })
        );
      } catch (error: unknown) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: sub.endpoint });
        }
      }
    })
  );
}

export async function sendWebPushToRoles(
  roles: Array<"admin" | "developer" | "sales">,
  payload: PushPayload,
  excludeUserId?: string
) {
  const users = await User.find({ role: { $in: roles } }).select("_id").lean();
  const userIds = users
    .map((u) => String(u._id))
    .filter((id) => (excludeUserId ? id !== excludeUserId : true));

  await sendWebPushToUsers(userIds, payload);
}
