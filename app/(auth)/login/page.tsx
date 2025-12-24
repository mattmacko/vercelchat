"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthForm } from "@/components/auth-form";
import { toast } from "@/components/toast";

const isSafeNextParam = (value: string | null): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

function LoginPageContent() {
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next") ?? null;
  const authError = searchParams?.get("error") ?? null;
  const safeNext = isSafeNextParam(nextParam) ? nextParam : null;
  const callbackUrl = safeNext ?? "/";

  useEffect(() => {
    if (authError) {
      toast({
        type: "error",
        description: "Sign in failed. Please try again.",
      });
    }
  }, [authError]);

  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Continue with Google to sign in
          </p>
        </div>
        <AuthForm callbackUrl={callbackUrl} showCredentials={false}>
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {"Don't have an account? "}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href={
                nextParam
                  ? `/register?next=${encodeURIComponent(nextParam)}`
                  : "/register"
              }
            >
              Sign up
            </Link>
            {" for free."}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
