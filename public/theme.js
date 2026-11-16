// Applies a saved theme before first paint. Without a saved choice the CSS follows the OS setting.
(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch {
    // Storage blocked: fall back to the OS setting.
  }
})();
