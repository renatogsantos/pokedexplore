import { useEffect, useState } from "react";

export default function StatusBar({ status }) {
  const [statusBar, setStatusBar] = useState(0);

  function statusClass() {
    if (status < 30) {
      return "30";
    } else if (status >= 30 && status < 60) {
      return "40";
    } else if (status >= 60 && status < 120) {
      return "100";
    } else if (status >= 120 && status < 200) {
      return "140";
    } else {
      return "";
    }
  }

  useEffect(() => {
    setStatusBar(status);
  }, [status]);

  return (
    <div className="status-bar-box">
      <div
        className={`status-bar-${statusClass()}`}
        style={{ width: `${statusBar / 2}%` }}
      />
    </div>
  );
}
