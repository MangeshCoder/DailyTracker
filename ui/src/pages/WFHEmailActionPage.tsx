import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { wfhApi } from "../services/api";

export const WFHEmailActionPage = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Processing request...");
  const [error, setError] = useState(false);

  const hasCalled = useRef(false); 

  useEffect(() => {
    if (hasCalled.current) return;  
    hasCalled.current = true;

    const token = searchParams.get("token");
    const status = searchParams.get("status");

    if (!token || !status) {
      setMessage("Invalid email link.");
      setError(true);
      setLoading(false);
      return;
    }

    wfhApi.reviewFromEmail(token, status)
      .then(() => {
        setMessage(`WFH request successfully ${status}.`);
      })
      .catch((err) => {
        setMessage(
          err.response?.data?.message ||
          err.response?.data ||
          "Failed to process request."
        );
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-md w-full shadow-xl">

        {loading && (
          <div className="animate-pulse text-slate-400">
            Processing request...
          </div>
        )}

        {!loading && (
          <>
            <div className="text-4xl mb-4">
              {error ? "❌" : "✅"}
            </div>

            <h2 className="text-xl font-semibold mb-2">
              {error ? "Action Failed" : "Success"}
            </h2>

            <p className="text-slate-400 text-sm">
              {message}
            </p>
          </>
        )}

      </div>
    </div>
  );
};