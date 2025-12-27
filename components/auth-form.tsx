"use client";

import Form from "next/form";
import { signIn } from "next-auth/react";
import { setSignupSource, type SignupSource } from "@/lib/gtm";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  callbackUrl = "/",
  showCredentials = true,
  signupSource,
}: {
  action?: string | ((formData: FormData) => void | Promise<void>);
  children: React.ReactNode;
  defaultEmail?: string;
  callbackUrl?: string;
  showCredentials?: boolean;
  signupSource?: SignupSource;
}) {
  const formBody = (
    <>
      <Button
        className="gap-2"
        onClick={() => {
          if (signupSource) {
            setSignupSource(signupSource);
          }

          signIn("google", { callbackUrl });
        }}
        type="button"
        variant="outline"
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center">
          <svg
            fill="none"
            height="20"
            viewBox="0 0 24 24"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21.6 12.2273C21.6 11.4818 21.5273 10.7636 21.3909 10.0727H12V14.16H17.1818C16.9573 15.3818 16.2727 16.3909 15.2 17.0909V19.6727H18.5091C20.5091 17.8364 21.6 15.2727 21.6 12.2273Z"
              fill="#4285F4"
            />
            <path
              d="M12 22C14.7 22 16.9636 21.1045 18.5091 19.6727L15.2 17.0909C14.3636 17.65 13.2909 17.9773 12 17.9773C9.39091 17.9773 7.18182 16.1273 6.39091 13.7818H3V16.45C4.53636 19.7273 8 22 12 22Z"
              fill="#34A853"
            />
            <path
              d="M6.39091 13.7818C6.19091 13.2227 6.08182 12.6227 6.08182 12C6.08182 11.3773 6.19091 10.7773 6.39091 10.2182V7.55H3C2.27273 9.04 1.86364 10.7182 1.86364 12.5C1.86364 14.2818 2.27273 15.96 3 17.45L6.39091 14.7818V13.7818Z"
              fill="#FBBC05"
            />
            <path
              d="M12 6.02273C13.4182 6.02273 14.6727 6.50909 15.6727 7.46364L18.5818 4.55455C16.9636 3.03636 14.7 2 12 2C8 2 4.53636 4.27273 3 7.55L6.39091 10.2182C7.18182 7.87273 9.39091 6.02273 12 6.02273Z"
              fill="#EA4335"
            />
          </svg>
        </span>
        Continue with Google
      </Button>

      {showCredentials ? (
        <>
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="email"
            >
              Email Address
            </Label>

            <Input
              autoComplete="email"
              autoFocus
              className="bg-muted text-md md:text-sm"
              defaultValue={defaultEmail}
              id="email"
              name="email"
              placeholder="user@acme.com"
              required
              type="email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-zinc-600 dark:text-zinc-400"
              htmlFor="password"
            >
              Password
            </Label>

            <Input
              className="bg-muted text-md md:text-sm"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>
        </>
      ) : null}

      {children}
    </>
  );

  if (action !== undefined) {
    return (
      <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
        {formBody}
      </Form>
    );
  }

  return <form className="flex flex-col gap-4 px-4 sm:px-16">{formBody}</form>;
}
