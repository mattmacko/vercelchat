"use server";

import { z } from "zod";

import {
  convertGuestUserToRegistered,
  createUser,
  getUser,
} from "@/lib/db/queries";
import { guestRegex } from "@/lib/constants";
import { logError, logInfo, maskEmail } from "@/lib/logging";

import { auth, signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const session = await auth();

    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    logInfo("auth:register", "Received register request", {
      sessionUserId: session?.user?.id,
      sessionUserType: session?.user?.type,
      sessionEmail: maskEmail(session?.user?.email),
      incomingEmail: maskEmail(validatedData.email),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      logInfo("auth:register", "User already exists for email", {
        sessionUserId: session?.user?.id,
        incomingEmail: maskEmail(validatedData.email),
      });
      return { status: "user_exists" } as RegisterActionState;
    }

    const sessionEmail = session?.user?.email ?? null;
    const sessionUserId = session?.user?.id ?? null;
    const isGuestSession =
      session?.user?.type === "guest" && guestRegex.test(sessionEmail ?? "");

    if (isGuestSession && sessionUserId && sessionEmail) {
      logInfo("auth:register", "Converting guest session to registered user", {
        sessionUserId,
        sessionEmail: maskEmail(sessionEmail),
        targetEmail: maskEmail(validatedData.email),
      });
      await convertGuestUserToRegistered({
        userId: sessionUserId,
        currentEmail: sessionEmail,
        nextEmail: validatedData.email,
        password: validatedData.password,
      });
    } else {
      logInfo("auth:register", "Creating new user record", {
        targetEmail: maskEmail(validatedData.email),
        sessionUserId,
        sessionUserType: session?.user?.type,
      });
      await createUser(validatedData.email, validatedData.password);
    }

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    logError("auth:register", "Registration failed with unexpected error", {
      error,
    });

    return { status: "failed" };
  }
};
