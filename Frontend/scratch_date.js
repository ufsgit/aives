const d = new Date();
d.setDate(d.getDate() + parseInt(null, 10));
try {
  console.log(d.toISOString());
} catch (e) {
  console.error("ERROR:", e.message);
}
