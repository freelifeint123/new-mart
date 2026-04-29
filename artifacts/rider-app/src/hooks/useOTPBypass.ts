import { useEffect, useState } from "react";

export interface AuthConfig {
  auth_mode: string;
  firebase_enabled: string;
  auth_otp_enabled: string;
  auth_email_enabled: string;
  auth_google_enabled: string;
  auth_facebook_enabled: string;
  otpBypassActive?: boolean;
  otpBypassExpiresAt?: string | null;
  bypassReason?: "global_disable" | "maintenance" | null;
  bypassMessage?: string | null;
}

/**
 * useOTPBypass hook for Rider App
 * 
 * Fetches OTP bypass status from the auth config endpoint.
 * Caches config locally for 5 minutes to reduce API calls.
 * Refreshes config every 30 seconds to stay in sync.
 */
export const useOTPBypass = () => {
  const [bypassActive, setBypassActive] = useState(false);
  const [bypassExpiresAt, setBypassExpiresAt] = useState<Date | null>(null);
  const [bypassMessage, setBypassMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuthConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/auth/config", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch auth config: ${response.status}`);
        }

        const config: AuthConfig = await response.json();

        // Update state from config
        setBypassActive(!!config.otpBypassActive);
        if (config.otpBypassExpiresAt) {
          setBypassExpiresAt(new Date(config.otpBypassExpiresAt));
        } else {
          setBypassExpiresAt(null);
        }
        setBypassMessage(config.bypassMessage || null);

        // Cache for 5 minutes
        localStorage.setItem("authConfigCache", JSON.stringify(config));
        localStorage.setItem("authConfigCacheTime", Date.now().toString());
      } catch (error) {
        console.error("[useOTPBypass] Failed to fetch config:", error);

        // Try to use cached config
        const cacheTime = localStorage.getItem("authConfigCacheTime");
        if (cacheTime && Date.now() - parseInt(cacheTime, 10) < 5 * 60 * 1000) {
          const cached = localStorage.getItem("authConfigCache");
          if (cached) {
            try {
              const config: AuthConfig = JSON.parse(cached);
              setBypassActive(!!config.otpBypassActive);
              if (config.otpBypassExpiresAt) {
                setBypassExpiresAt(new Date(config.otpBypassExpiresAt));
              }
              setBypassMessage(config.bypassMessage || null);
            } catch (parseError) {
              console.error("[useOTPBypass] Failed to parse cache:", parseError);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAuthConfig();

    // Refresh every 30 seconds
    const interval = setInterval(fetchAuthConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  const remainingSeconds = bypassExpiresAt
    ? Math.max(0, Math.ceil((bypassExpiresAt.getTime() - Date.now()) / 1000))
    : 0;

  const isExpired = remainingSeconds === 0 && bypassActive;

  return {
    bypassActive: bypassActive && !isExpired,
    bypassExpiresAt: isExpired ? null : bypassExpiresAt,
    bypassMessage,
    remainingSeconds,
    loading,
  };
};
