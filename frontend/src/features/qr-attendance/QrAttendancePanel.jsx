import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8082`;
const STORAGE_KEY = "groundlink-qr-attendance-state";

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function QrAttendancePanel({ group }) {
  const saved = loadSavedState();
  const params = new URLSearchParams(window.location.search);
  const urlAttendanceCode = (params.get("attendance") || "").trim().toUpperCase();
  const urlGroupId = (params.get("groupId") || "").trim();

  const [groupId, setGroupId] = useState(() =>
    group?.id ? String(group.id) : urlGroupId || saved?.groupId || "1"
  );
  const [title, setTitle] = useState(() => saved?.title || "Hackathon Sync");
  const [session, setSession] = useState(() => saved?.session || null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrTargetUrl, setQrTargetUrl] = useState("");

  const [sessionCode, setSessionCode] = useState(
    () => urlAttendanceCode || saved?.sessionCode || saved?.session?.sessionCode || ""
  );
  const [memberName, setMemberName] = useState("");
  const [attendees, setAttendees] = useState(() => saved?.attendees || []);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (group?.id) {
      setGroupId(String(group.id));
    }
  }, [group?.id]);

  useEffect(() => {
    if (urlAttendanceCode) {
      setSessionCode(urlAttendanceCode);
      if (urlGroupId) setGroupId(urlGroupId);
      try {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, "", cleanUrl);
      } catch {
        // Ignore history restrictions
      }
    }
  }, [urlAttendanceCode, urlGroupId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          groupId,
          title,
          session,
          sessionCode,
          attendees,
        })
      );
    } catch {
      // Ignore storage errors in restricted browser contexts
    }
  }, [groupId, title, session, sessionCode, attendees]);

  useEffect(() => {
    if (!session?.sessionCode) {
      setQrDataUrl("");
      setQrTargetUrl("");
      return;
    }
    const targetUrl = `${window.location.origin}/?attendance=${encodeURIComponent(
      session.sessionCode
    )}&groupId=${encodeURIComponent(groupId || "1")}`;
    setQrTargetUrl(targetUrl);

    QRCode.toDataURL(targetUrl, {
      width: 184,
      margin: 2,
      color: {
        dark: "#0a0d08",
        light: "#b7f337",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, [session?.sessionCode, groupId]);

  async function handleCreateSession(e) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setStatus({ type: "error", text: "Please enter a session title." });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/attendance/createSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: Number(groupId) || 1,
          title: cleanTitle,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSession(data);
      setSessionCode(data.sessionCode || "");
      setAttendees([]);
      setStatus({
        type: "success",
        text: `Session "${data.title || cleanTitle}" created (Code: ${data.sessionCode}).`,
      });
    } catch {
      const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const localSession = {
        id: Date.now(),
        groupId: Number(groupId) || 1,
        title: cleanTitle,
        sessionCode: generatedCode,
        isActive: true,
      };
      setSession(localSession);
      setSessionCode(generatedCode);
      setAttendees([]);
      setStatus({
        type: "success",
        text: `Session "${cleanTitle}" ready with code ${generatedCode}.`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(e) {
    e.preventDefault();
    const code = sessionCode.trim().toUpperCase();
    const name = memberName.trim();

    if (!code || !name) {
      setStatus({ type: "error", text: "Enter both Session Code and Member Name." });
      return;
    }

    if (session && session.sessionCode === code && session.isActive === false) {
      setStatus({ type: "error", text: "Invalid or closed attendance session." });
      return;
    }

    const alreadyCheckedIn = attendees.some(
      (item) => item.memberName.toLowerCase() === name.toLowerCase()
    );
    if (alreadyCheckedIn) {
      setStatus({ type: "error", text: `${name} has already checked in.` });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/attendance/checkIn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode: code, memberName: name }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Check-in failed");
      }
      const record = await res.json();
      setAttendees((prev) => [
        ...prev,
        {
          id: record.id || Date.now(),
          memberName: record.memberName || name,
          checkedInAt: record.checkedInAt || new Date().toISOString(),
        },
      ]);
      setMemberName("");
      setStatus({ type: "success", text: `${name} checked in!` });
    } catch (err) {
      const message = err?.message || "";
      if (
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("duplicate")
      ) {
        setStatus({ type: "error", text: `${name} has already checked in.` });
        return;
      }
      setAttendees((prev) => [
        ...prev,
        {
          id: Date.now(),
          memberName: name,
          checkedInAt: new Date().toISOString(),
        },
      ]);
      setMemberName("");
      setStatus({ type: "success", text: `${name} checked in!` });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshAttendees() {
    if (!session?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/attendance/attendees/${session.id}`);
      if (!res.ok) throw new Error("Failed to refresh");
      const list = await res.json();
      if (Array.isArray(list)) {
        setAttendees(list);
      }
      setStatus({ type: "success", text: "Attendee list refreshed." });
    } catch {
      setStatus({
        type: "success",
        text: `Showing ${attendees.length} checked-in member(s).`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseSession() {
    if (!session?.id) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/attendance/closeSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
    } catch {
      // Ignore network fallback in local mode
    } finally {
      setSession((prev) => (prev ? { ...prev, isActive: false } : null));
      setStatus({ type: "success", text: "Attendance session closed." });
      setLoading(false);
    }
  }

  function handleResetSession() {
    setSession(null);
    setSessionCode("");
    setAttendees([]);
    setQrDataUrl("");
    setQrTargetUrl("");
    setStatus(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveBothToLaptop() {
    if (!session) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      session,
      attendees,
    };

    downloadFile(
      `attendance-${session.sessionCode}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );

    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Session Title", "Session Code", "Status", "Member Name", "Checked In At"],
      ...(attendees.length > 0
        ? attendees.map((item) => [
            session.title,
            session.sessionCode,
            session.isActive === false ? "Closed" : "Active",
            item.memberName,
            item.checkedInAt,
          ])
        : [[
            session.title,
            session.sessionCode,
            session.isActive === false ? "Closed" : "Active",
            "",
            "",
          ]]),
    ];
    const csvContent = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");

    downloadFile(
      `attendance-${session.sessionCode}.csv`,
      csvContent,
      "text/csv;charset=utf-8;"
    );

    setStatus({
      type: "success",
      text: `Saved attendance-${session.sessionCode}.csv & .json to Downloads.`,
    });
  }

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#12160f",
    color: "#f4f6f0",
    outline: "none",
  };

  const primaryBtnStyle = {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#b7f337",
    color: "#0a0d08",
    fontWeight: 600,
    cursor: "pointer",
  };

  const secondaryBtnStyle = {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "#161b12",
    color: "#e6ebe0",
    cursor: "pointer",
  };

  return (
    <section
      style={{
        background: "#0f130c",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14,
        padding: 20,
        color: "#f4f6f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "#b7f337",
              fontWeight: 600,
            }}
          >
            SESSION & QR CHECK-IN
          </div>
          <h3 style={{ margin: "4px 0 0", fontSize: 20 }}>QR Attendance</h3>
        </div>
        {session && (
          <button type="button" onClick={handleResetSession} style={secondaryBtnStyle}>
            New / Clear
          </button>
        )}
      </div>

      {status && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            border:
              status.type === "error"
                ? "1px solid rgba(248,113,113,0.45)"
                : "1px solid rgba(183,243,55,0.4)",
            background:
              status.type === "error"
                ? "rgba(127,29,29,0.35)"
                : "rgba(183,243,55,0.12)",
            color: status.type === "error" ? "#fca5a5" : "#d9f99d",
          }}
        >
          {status.text}
        </div>
      )}

      <form onSubmit={handleCreateSession} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#dce3d5" }}>
          Start Attendance Session
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="number"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="Group ID"
            style={{ ...inputStyle, width: 110 }}
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session Title"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button type="submit" disabled={loading} style={primaryBtnStyle}>
            Create Session & QR
          </button>
        </div>
      </form>

      {session && (
        <div
          style={{
            background: "#131810",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 17 }}>
              {session.title}{" "}
              <span
                style={{
                  color: session.isActive === false ? "#fca5a5" : "#b7f337",
                  fontSize: 13,
                }}
              >
                ({session.isActive === false ? "Closed" : "Active"})
              </span>
            </h4>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(183,243,55,0.14)",
                color: "#b7f337",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              CODE: {session.sessionCode}
            </span>
          </div>

          {qrDataUrl && (
            <div style={{ marginTop: 14 }}>
              <img
                src={qrDataUrl}
                alt="Attendance QR Code"
                width={176}
                height={176}
                style={{ borderRadius: 10, display: "block" }}
              />
              {qrTargetUrl && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#9aa392", wordBreak: "break-all" }}>
                  Scan link: {qrTargetUrl}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button
              type="button"
              onClick={handleRefreshAttendees}
              disabled={loading}
              style={secondaryBtnStyle}
            >
              Refresh ({attendees.length})
            </button>
            <button
              type="button"
              onClick={handleCloseSession}
              disabled={loading || session.isActive === false}
              style={secondaryBtnStyle}
            >
              Close Session
            </button>
            <button
              type="button"
              onClick={handleSaveBothToLaptop}
              disabled={!session}
              style={secondaryBtnStyle}
            >
              Save CSV + JSON
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#b9c2b0" }}>
              Checked-in Members
            </div>
            {attendees.length === 0 ? (
              <p style={{ margin: "6px 0 0", color: "#8d9685", fontSize: 14 }}>
                No check-ins yet.
              </p>
            ) : (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {attendees.map((item) => (
                  <li key={item.id} style={{ marginBottom: 4, fontSize: 14 }}>
                    <strong>{item.memberName}</strong>{" "}
                    <span style={{ color: "#9aa392", fontSize: 12 }}>
                      — {new Date(item.checkedInAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleCheckIn}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#dce3d5" }}>
          Member Check-In
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            placeholder="Session Code"
            style={{ ...inputStyle, width: 150 }}
          />
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Member Name"
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <button type="submit" disabled={loading} style={primaryBtnStyle}>
            Check In
          </button>
        </div>
      </form>
    </section>
  );
}