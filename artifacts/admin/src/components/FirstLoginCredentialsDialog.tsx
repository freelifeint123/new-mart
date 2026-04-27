/**
 * FirstLoginCredentialsDialog
 *
 * Optional post-login popup surfaced to the seeded super-admin while
 * they are still using the bootstrap default credentials
 * (`admin` / `Toqeerkhan@123.com`). The user may:
 *   - Pick a new username and/or password, or
 *   - Click "Skip for now" to keep the defaults working for this session.
 *
 * Nothing in the app is gated on this dialog — both branches return the
 * user to whatever route they were on. The popup never re-opens after
 * the admin has either submitted a change or dismissed it (until the
 * next fresh login).
 *
 * Wire-up: rendered globally inside <AdminLayout> from App.tsx so it is
 * available on every authenticated route.
 *
 * Visibility model
 * ----------------
 * Visibility is driven by a local `open` state instead of being derived
 * directly from `state.usingDefaultCredentials`. The reason: the
 * password rotation API clears `usingDefaultCredentials` server-side
 * the moment it succeeds, so a derived `open` would auto-close the
 * dialog the instant the password call resolves — even if the user
 * also asked us to update their username and that PATCH is still in
 * flight or has failed. Owning `open` locally lets the dialog stay
 * up across the multi-step submit so partial-failure errors remain
 * visible and retryable in-context.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/adminAuthContext";

/** Same rules the API enforces (validatePasswordStrength). */
function validateStrength(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Password must contain at least 1 uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least 1 number.";
  return null;
}

export function FirstLoginCredentialsDialog() {
  const [, setLocation] = useLocation();
  const { state, changePassword, updateOwnProfile, dismissDefaultCredentialsPrompt } =
    useAdminAuth();
  const { toast } = useToast();

  // Upstream signal that the popup *should* be shown for this session.
  // Computed from auth state but only used to *open* the dialog — never
  // to close it (see file header for rationale).
  const wantsToShow = useMemo(
    () =>
      !!state.accessToken &&
      !!state.usingDefaultCredentials &&
      !state.defaultCredentialsDismissed,
    [state.accessToken, state.usingDefaultCredentials, state.defaultCredentialsDismissed],
  );

  // Locally-owned visibility. Seeded from `wantsToShow`, then only
  // mutated by user actions ("Skip", successful submit) or logout.
  const [open, setOpen] = useState(wantsToShow);

  // Re-open whenever upstream conditions newly become true (e.g. fresh
  // login after a previous logout).
  useEffect(() => {
    if (wantsToShow) setOpen(true);
  }, [wantsToShow]);

  // Hard-close the dialog on logout so it never lingers across sessions.
  useEffect(() => {
    if (!state.accessToken) setOpen(false);
  }, [state.accessToken]);

  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Tracks whether the password half of a multi-step submit already
  // succeeded. If a subsequent username PATCH fails the user shouldn't
  // be asked to re-enter (and re-submit) the password they just rotated.
  const [passwordSavedThisSession, setPasswordSavedThisSession] = useState(false);

  // Reset the form whenever the popup re-opens for a new session.
  useEffect(() => {
    if (open) {
      setUsername(state.user?.username ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormError(null);
      setPasswordSavedThisSession(false);
    }
  }, [open, state.user?.username]);

  const handleSkip = () => {
    dismissDefaultCredentialsPrompt();
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedUsername = username.trim();
    const currentUsername = state.user?.username ?? "";
    const wantsUsernameChange =
      trimmedUsername.length > 0 && trimmedUsername !== currentUsername;
    const wantsPasswordChange =
      !passwordSavedThisSession &&
      (newPassword.length > 0 || currentPassword.length > 0 || confirmPassword.length > 0);

    if (!wantsUsernameChange && !wantsPasswordChange) {
      setFormError(
        passwordSavedThisSession
          ? "Pick a new username, or click Skip for now."
          : "Update your username, password, or both — or click Skip for now.",
      );
      return;
    }

    if (wantsPasswordChange) {
      if (!currentPassword) {
        setFormError("Enter your current password to confirm a password change.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setFormError("The new password and confirmation do not match.");
        return;
      }
      const strengthError = validateStrength(newPassword);
      if (strengthError) {
        setFormError(strengthError);
        return;
      }
      if (newPassword === currentPassword) {
        setFormError("The new password must be different from the current one.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Step 1 — rotate the password (if requested). The API issues a
      // fresh access token which `changePassword` mirrors into auth
      // state, so any subsequent PATCH below picks it up automatically.
      if (wantsPasswordChange) {
        try {
          await changePassword(currentPassword, newPassword);
          setPasswordSavedThisSession(true);
          // Clear password inputs — the values entered are now stale
          // (currentPassword no longer matches what's on the server).
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } catch (err) {
          setFormError(
            err instanceof Error ? err.message : "Failed to update your password.",
          );
          return; // keep dialog open, password section still active
        }
      }

      // Step 2 — update the username (if requested). On failure here
      // the dialog stays open with a clear message so the user can
      // correct and retry the username independently. The password —
      // if it was rotated above — is already persisted server-side.
      if (wantsUsernameChange) {
        try {
          await updateOwnProfile({ username: trimmedUsername });
        } catch (err) {
          const baseMsg =
            err instanceof Error ? err.message : "Failed to update your username.";
          setFormError(
            passwordSavedThisSession
              ? `Password was updated, but username change failed: ${baseMsg}`
              : baseMsg,
          );
          return; // keep dialog open, username field still active
        }
      }

      // All requested operations succeeded.
      toast({
        title: "Credentials updated",
        description:
          wantsPasswordChange && wantsUsernameChange
            ? "Use your new username and password on next login."
            : wantsPasswordChange
              ? "Use your new password on next login."
              : "Use your new username on next login.",
      });
      dismissDefaultCredentialsPrompt();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Treat any close attempt (Esc, outside-click, X button) as
        // "Skip for now" — defaults stay valid. Suppress while we are
        // mid-submit so a stray click can't drop the dialog before the
        // server round-trips finish.
        if (!next && !submitting) handleSkip();
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="dialog-first-login-credentials">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Customise your admin credentials</DialogTitle>
              <DialogDescription className="mt-1">
                You're signed in with the default credentials. Pick a new
                username and/or password, or skip for now to keep using
                the defaults.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="flcd-username">
              New username
            </label>
            <Input
              id="flcd-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={state.user?.username ?? "admin"}
              autoComplete="username"
              disabled={submitting}
              data-testid="input-new-username"
            />
            <p className="text-xs text-muted-foreground">
              Leave unchanged to keep the current username.
            </p>
          </div>

          {passwordSavedThisSession ? (
            <div
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2"
              data-testid="text-password-saved"
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Password updated.</p>
                <p className="text-xs opacity-80">
                  Finish by saving the new username, or click Skip for now.
                </p>
              </div>
            </div>
          ) : (
            <div className="border-t pt-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="flcd-current">
                  Current password
                </label>
                <Input
                  id="flcd-current"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required to change password"
                  autoComplete="current-password"
                  disabled={submitting}
                  data-testid="input-current-password"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="flcd-new">
                  New password
                </label>
                <div className="relative">
                  <Input
                    id="flcd-new"
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 chars, 1 uppercase, 1 number"
                    autoComplete="new-password"
                    disabled={submitting}
                    className="pr-10"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPasswords((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="flcd-confirm">
                  Confirm new password
                </label>
                <Input
                  id="flcd-confirm"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter the new password"
                  autoComplete="new-password"
                  disabled={submitting}
                  data-testid="input-confirm-password"
                />
              </div>
            </div>
          )}

          {formError && (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="text-credentials-error"
            >
              {formError}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                handleSkip();
                setLocation("/set-new-password");
              }}
              disabled={submitting}
              className="sm:mr-auto"
              data-testid="button-open-full-screen"
            >
              Open the full password screen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={submitting}
              data-testid="button-skip-credentials"
            >
              Skip for now
            </Button>
            <Button type="submit" disabled={submitting} data-testid="button-save-credentials">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FirstLoginCredentialsDialog;
