import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { leaveApi } from "../services/api";

export const EmailAction = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Processing...");
  const hasCalled = useRef(false);

  useEffect(() => {
    if (hasCalled.current) return;
    hasCalled.current = true;

    const token = searchParams.get("token");
    const status = searchParams.get("status");

    if (!token || !status) {
      setMessage("Invalid email link.");
      return;
    }

    leaveApi.reviewFromEmail(token, status)
      .then(() => {
        setMessage(`✅ Leave ${status} Successfully`);
      })
      .catch((err) => {
        setMessage(
          "❌ " +
          (err.response?.data?.message ||
           err.response?.data ||
           "Something went wrong")
        );
      });

  }, [searchParams]);

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontFamily: "Segoe UI"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
      }}>
        <h2>{message}</h2>
      </div>
    </div>
  );
};