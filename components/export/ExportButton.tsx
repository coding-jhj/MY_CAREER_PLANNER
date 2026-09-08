"use client";

import { useState } from "react";

function filenameFrom(response: Response): string {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] ?? "pds-export-v2.json";
}

export function ExportButton() {
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/export");
      if (!response.ok) throw new Error("내보내기에 실패했습니다. 다시 시도해 주세요.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = filenameFrom(response); link.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "내보내기에 실패했습니다."); } finally { setLoading(false); }
  };
  return <div className="export-control"><button className="secondary" type="button" onClick={() => void download()} disabled={loading}>{loading ? "내보내는 중…" : "JSON 내보내기"}</button>{error && <p className="inline-error" role="alert">{error}</p>}</div>;
}
