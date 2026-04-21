"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function WebPushRegistrar() {
  const { data: session } = useSession();
  const sessionKey = `${session?.user?.id ?? ""}:${session?.user?.role ?? ""}`;
  const dismissStorageKey = `push_prompt_dismissed:${session?.user?.id ?? ""}`;
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const subscribeUser = async (registration: ServiceWorkerRegistration, publicKey: string) => {
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!res.ok) {
      throw new Error("Failed to register push subscription");
    }
  };

  useEffect(() => {
    if (!session?.user?.id || typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(dismissStorageKey) === "1";
    setIsDismissed(dismissed);
  }, [dismissStorageKey, session?.user?.id]);

  useEffect(() => {
    const registerPush = async () => {
      if (!session?.user?.id) return;
      if (session.user.role === "client") return;
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setIsSupported(false);
        return;
      }

      setPermission(Notification.permission);

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ((window.navigator as Navigator & { standalone?: boolean }).standalone === true);
      setIsStandalone(standalone);
      setIsIos(/iPhone|iPad|iPod/i.test(window.navigator.userAgent));

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) return;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await registration.update();

        if (Notification.permission !== "granted") return;

        await subscribeUser(registration, publicKey);
      } catch (error) {
        console.error("Web push registration failed:", error);
      }
    };

    registerPush();
  }, [sessionKey]);

  const handleEnableNotifications = async () => {
    if (!session?.user?.id) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("VAPID key is missing in environment configuration");
      return;
    }

    if (isIos && !isStandalone) {
      toast.info("On iOS, install this app to Home Screen first to enable push notifications");
      return;
    }

    setIsEnabling(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await registration.update();

      let currentPermission = Notification.permission;
      if (currentPermission === "default") {
        currentPermission = await Notification.requestPermission();
      }
      setPermission(currentPermission);

      if (currentPermission !== "granted") {
        toast.error("Notification permission is blocked. Please allow notifications in browser settings.");
        return;
      }

      await subscribeUser(registration, publicKey);
      setIsDismissed(false);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(dismissStorageKey);
      }
      toast.success("Push notifications enabled");
    } catch (error) {
      console.error("Enable notifications failed:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setIsEnabling(false);
    }
  };

  const handleClosePrompt = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissStorageKey, "1");
    }
  };

  if (!session?.user?.id || session.user.role === "client" || !isSupported || permission === "granted" || isDismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 320,
        zIndex: 1200,
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xl)",
        padding: 14,
      }}
    >
      <button
        onClick={handleClosePrompt}
        aria-label="Close push notification prompt"
        className="btn-icon"
        style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, fontSize: 12 }}
      >
        x
      </button>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Enable Push Notifications</div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
        Get instant alerts for task updates and payment events.
      </div>
      {isIos && !isStandalone && (
        <div style={{ fontSize: 12, color: "var(--text-warning)", marginBottom: 10 }}>
          iOS requirement: use Safari and install this app to Home Screen first.
        </div>
      )}
      {permission === "denied" && (
        <div style={{ fontSize: 12, color: "var(--text-danger)", marginBottom: 10 }}>
          Notifications are blocked. Allow notifications in browser/site settings.
        </div>
      )}
      <button
        className="btn btn-primary"
        onClick={handleEnableNotifications}
        disabled={isEnabling}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {isEnabling ? "Enabling..." : "Enable Notifications"}
      </button>
      <button
        className="btn btn-secondary"
        onClick={handleClosePrompt}
        style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
      >
        Not now
      </button>
    </div>
  );
}
