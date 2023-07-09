export default function StatusBar({ status }) {
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
  return (
    <div className="status-bar-box">
      <div
        className={`status-bar-${statusClass()}`}
        style={{ width: `${status / 2}%` }}
      />
    </div>
  );
}
