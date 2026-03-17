"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OAuthSuccessContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const clientId = searchParams.get("clientId");
  const [countdown, setCountdown] = useState(2);

  const isSuccess = !error && !!clientId;

  useEffect(() => {
    // Notify the parent window
    if (typeof window !== "undefined" && window.opener) {
      window.opener.postMessage(
        {
          type: "META_OAUTH_RESULT",
          success: isSuccess,
          clientId: clientId ?? undefined,
          error: error ?? undefined,
        },
        window.location.origin
      );
    }

    // Countdown then close
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          window.close();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSuccess, clientId, error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        {isSuccess ? (
          <>
            {/* Success */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Connected Successfully</h1>
            <p className="text-sm text-gray-500">
              Your Meta account has been connected. This window will close in {countdown}s.
            </p>
          </>
        ) : (
          <>
            {/* Error */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Connection Failed</h1>
            <p className="text-sm text-red-600 break-words">
              {error ?? "An unexpected error occurred."}
            </p>
            <p className="text-xs text-gray-400">
              This window will close in {countdown}s.
            </p>
          </>
        )}

        <button
          onClick={() => window.close()}
          className="mt-2 text-xs text-gray-400 underline hover:text-gray-600"
        >
          Close now
        </button>
      </div>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <OAuthSuccessContent />
    </Suspense>
  );
}
