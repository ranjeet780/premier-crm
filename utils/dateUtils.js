function formatDateIST(date) {
  const d = new Date(date);
  d.setHours(d.getHours() + 5);
  d.setMinutes(d.getMinutes() + 30);
  return d.toISOString().split("T")[0];
}

function formatTime(date) {
  const d = new Date(date);
  d.setHours(d.getHours() + 5);
  d.setMinutes(d.getMinutes() + 30);
  return d.toISOString().split("T")[1].slice(0, 8);
}

function parseISTLocalToUTC(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes, seconds] = timeString.split(":").map(Number);

  // Create a date object in IST (UTC+5:30)
  const dateIST = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  // Subtract 5 hours and 30 minutes to get the UTC time
  dateIST.setUTCHours(dateIST.getUTCHours() - 5);
  dateIST.setUTCMinutes(dateIST.getUTCMinutes() - 30);

  return dateIST;
}

module.exports = { formatDateIST, formatTime, parseISTLocalToUTC };
