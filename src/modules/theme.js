// ========== Theme Management ==========

export function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  updateThemeButton();
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  updateThemeButton();
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function updateThemeButton() {
  const themeButton = document.getElementById('themeToggle');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  
  if (themeButton) {
    themeButton.innerHTML = currentTheme === 'light' ? '🌙' : '☀️';
    themeButton.title = currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }
}