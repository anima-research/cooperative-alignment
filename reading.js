(() => {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const printButton = document.getElementById('print-button');
  const chapters = [...document.querySelectorAll('.chapter')];
  const readingSections = [...document.querySelectorAll('.argument-map-intro, .short-version, .chapter')];
  const links = [...document.querySelectorAll('[data-chapter-link]')];
  const mobileToc = document.getElementById('mobile-toc');
  const progress = document.getElementById('progress-bar');
  const position = document.getElementById('reading-position');
  const initialReadingTime = position.textContent;
  const mobileLabel = document.getElementById('mobile-chapter-label');
  let savedTheme;
  try { savedTheme = localStorage.getItem('cooperative-alignment-theme'); } catch {}
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  function setTheme(theme) {
    root.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    toggle.textContent = next === 'dark' ? 'Dark' : 'Light';
    toggle.setAttribute('aria-label', `Switch to ${next} appearance`);
  }
  setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : systemDark ? 'dark' : 'light');
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('cooperative-alignment-theme', root.dataset.theme); } catch {}
  });
  printButton.hidden = false;
  printButton.addEventListener('click', () => window.print());

  links.forEach(link => link.addEventListener('click', () => {
    if (mobileToc.open) mobileToc.open = false;
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileToc.open) {
      mobileToc.open = false;
      mobileToc.querySelector('summary').focus();
    }
  });

  let lastChapter = '';
  let framePending = false;
  function updateReadingPosition() {
    framePending = false;
    const offset = window.innerWidth <= 820 ? 155 : 145;
    let current = readingSections[0];
    for (const chapter of readingSections) {
      if (chapter.getBoundingClientRect().top <= offset) current = chapter;
      else break;
    }
    if (current.id !== lastChapter) {
      lastChapter = current.id;
      links.forEach(link => {
        if (link.dataset.chapterLink === current.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      const index = chapters.indexOf(current) + 1;
      mobileLabel.textContent = index === 0 ? (current.id === 'argument-map' ? 'Argument map' : 'Short version') : `${String(index).padStart(2, '0')} / ${chapters.length}`;
    }
    const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    const ratio = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    progress.style.transform = `scaleX(${ratio})`;
    position.textContent = window.scrollY < 150 ? initialReadingTime : `${Math.round(ratio * 100)}% read`;
  }
  function queueUpdate() {
    if (!framePending) {
      framePending = true;
      requestAnimationFrame(updateReadingPosition);
    }
  }
  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate);
  window.addEventListener('load', queueUpdate);
  if (document.fonts) document.fonts.ready.then(queueUpdate);
  queueUpdate();
})();
