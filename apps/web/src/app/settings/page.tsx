"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/auth-api";

const emptyAccountForm = {
  full_name: "",
  email: "",
};

const emptyPasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  });

  useEffect(() => {
    if (!meQuery.data) return;
    setAccountForm({
      full_name: meQuery.data.full_name,
      email: meQuery.data.email,
    });
  }, [meQuery.data]);

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      setAccountMessage(null);
      return authApi.updateMe({
        full_name: accountForm.full_name.trim(),
        email: accountForm.email.trim(),
      });
    },
    onSuccess: () => {
      setAccountMessage("Account details updated.");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      setAccountMessage(error.response?.data?.detail ?? "Failed to update account.");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      setPasswordMessage(null);

      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error("New password and confirmation do not match.");
      }

      return authApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
    },
    onSuccess: async () => {
      setPasswordMessage("Password changed. Please sign in again.");
      setPasswordForm(emptyPasswordForm);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/login");
      router.refresh();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setPasswordMessage(
        error.response?.data?.detail ?? error.message ?? "Failed to change password."
      );
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
  });

  const sessionFacts = useMemo(
    () => [
      { label: "Auth model", value: "Browser session cookies" },
      { label: "Session scope", value: "Current browser only" },
      { label: "Refresh behavior", value: "Automatic on expired access tokens" },
    ],
    []
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account details, password, and current browser session.
          </p>
        </div>

        {meQuery.isLoading && (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Loading your account settings...
          </div>
        )}

        {meQuery.isError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load account settings. Refresh the page and try again.
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Account details</h2>
                <p className="text-sm text-muted-foreground">
                  Update the core identity information used across your HireFlow workspace.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={accountForm.full_name}
                    onChange={(e) =>
                      setAccountForm((current) => ({ ...current, full_name: e.target.value }))
                    }
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={accountForm.email}
                    onChange={(e) =>
                      setAccountForm((current) => ({ ...current, email: e.target.value }))
                    }
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => updateAccountMutation.mutate()}
                  disabled={updateAccountMutation.isPending || meQuery.isLoading}
                >
                  {updateAccountMutation.isPending ? "Saving..." : "Save account changes"}
                </Button>
                {accountMessage && (
                  <p className="text-sm text-muted-foreground">{accountMessage}</p>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Password & security</h2>
                <p className="text-sm text-muted-foreground">
                  Change your password for this account. You will be signed out afterwards.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="current_password">Current password</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm((current) => ({
                        ...current,
                        current_password: e.target.value,
                      }))
                    }
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <Label htmlFor="new_password">New password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm((current) => ({ ...current, new_password: e.target.value }))
                    }
                    placeholder="Minimum 8 chars, 1 uppercase, 1 number"
                  />
                </div>

                <div>
                  <Label htmlFor="confirm_password">Confirm new password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirm_password: e.target.value,
                      }))
                    }
                    placeholder="Repeat the new password"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? "Updating..." : "Change password"}
                </Button>
                {passwordMessage && (
                  <p className="text-sm text-muted-foreground">{passwordMessage}</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold">Current session</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This app uses secure browser cookies for sign-in and automatic refresh.
              </p>

              <div className="mt-6 space-y-3">
                {sessionFacts.map((fact) => (
                  <div key={fact.label} className="rounded-md border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {fact.label}
                    </p>
                    <p className="mt-1 text-sm font-medium">{fact.value}</p>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Signing out..." : "Sign out of this browser"}
              </Button>
            </section>

            <section className="rounded-lg border bg-card p-6">
              <h2 className="text-xl font-semibold">Account status</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-muted-foreground">Email verification</span>
                  <span className="font-medium">
                    {meQuery.data?.is_verified ? "Verified" : "Pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-muted-foreground">Account state</span>
                  <span className="font-medium">
                    {meQuery.data?.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="font-medium">
                    {meQuery.data
                      ? new Date(meQuery.data.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
