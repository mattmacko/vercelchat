"use client";

import { sendGTMEvent } from "@next/third-parties/google";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { clearSignupSource, getSignupSource } from "@/lib/gtm";

export function GTMClientTracker() {
  const { data: session, status, update } = useSession();
  const signupTracked = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      signupTracked.current = false;
      lastUserId.current = null;
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    const userType = session?.user?.type;
    if (!userType || userType === "guest") {
      return;
    }

    const userId = session?.user?.id ?? null;

    if (userId && lastUserId.current && lastUserId.current !== userId) {
      signupTracked.current = false;
    }

    lastUserId.current = userId;

    const signupSource = getSignupSource();

    let alreadySent = false;

    if (userId) {
      try {
        alreadySent =
          window.sessionStorage.getItem(`gtm_signup_sent:${userId}`) === "1";
      } catch (_error) {}
    }

    if (session?.user?.justSignedUp && !signupTracked.current && !alreadySent) {
      signupTracked.current = true;

      const payload: Record<string, unknown> = {
        event: "sign_up",
      };

      if (session.user.signupMethod) {
        payload.method = session.user.signupMethod;
      }

      if (signupSource) {
        payload.source = signupSource;
      }

      sendGTMEvent(payload);

      if (userId) {
        try {
          window.sessionStorage.setItem(`gtm_signup_sent:${userId}`, "1");
        } catch (_error) {}
      }

      update({ justSignedUp: false }).catch(() => {});
      if (signupSource) {
        clearSignupSource();
      }
    }
  }, [
    session?.user?.id,
    session?.user?.justSignedUp,
    session?.user?.signupMethod,
    session?.user?.type,
    status,
    update,
  ]);

  return null;
}
