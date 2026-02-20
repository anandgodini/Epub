// generateHtml.ts
// Generates a modern, premium index.html viewer for the converted EPUB content.
// Uses regex-based TOC parsing — no DOMParser required (works in React Native).

function escapeHtml(str: string): string {
  return str.replace(
    /([&<>"'\u00A0\u2022\u2026\u2013\u2014\u2018\u2019\u201C\u201D\u0010-\u001F\u0016])/g,
    (match) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '\u00A0': '&#160;',
        '\u2022': '&#8226;',
        '\u2026': '&#8230;',
        '\u2013': '&#8211;',
        '\u2014': '&#8212;',
        '\u2018': '&#8216;',
        '\u2019': '&#8217;',
        '\u201C': '&#8220;',
        '\u201D': '&#8221;',
        '\u0010': '&#16;',
        '\u0011': '&#17;',
        '\u0012': '&#18;',
        '\u0013': '&#19;',
        '\u0014': '&#20;',
        '\u0015': '&#21;',
        '\u0016': '0',
        '\u0017': '&#23;',
        '\u0018': '&#24;',
        '\u0019': '&#25;',
        '\u001A': '&#26;',
        '\u001B': '&#27;',
        '\u001C': '&#28;',
        '\u001D': '&#29;',
        '\u001E': '&#30;',
        '\u001F': '&#31;',
      };
      return map[match] ?? match;
    }
  );
}

interface TocItem {
  href: string;
  text: string;
  pagename: string;
}

function parseTocItems(tocContent: string): TocItem[] {
  const items: TocItem[] = [];
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(tocContent)) !== null) {
    const href = match[1];
    const rawText = match[2].replace(/<[^>]+>/g, '').trim();
    if (rawText) {
      const text = escapeHtml(rawText);
      const pagename = href.split('/').slice(-2).join('/');
      items.push({ href, text, pagename });
    }
  }
  return items;
}

export default function generateHtml(fileNames: string[], tocContent: string): string {
  const liData = parseTocItems(tocContent);

  liData.forEach((item) => {
    const matchedFile = fileNames.find((f) => f.endsWith(item.pagename));
    if (matchedFile) item.href = matchedFile;
  });

  const newfilenames = liData.map((item) => escapeHtml(item.href));

  const pageLinks = liData
    .map(
      (file, index) =>
        `<li class="toc-item"><a href="#" onclick='selectPage("${escapeHtml(file.href)}", ${index + 1}); return false;'><span class="toc-num">${index + 1}</span>${file.text}</a></li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>EPUB Viewer</title>
  <style>
    :root {
      --sidebar-w: 280px;
      --header-h: 52px;
      --bg: #0f172a;
      --surface: #1e293b;
      --surface2: #273549;
      --accent: #6366f1;
      --accent-light: #818cf8;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --border: #334155;
      --radius: 10px;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      overflow: hidden;
    }

    /* ── Top Bar ── */
    #topbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--header-h);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      z-index: 200;
      backdrop-filter: blur(12px);
    }

    #menu-btn {
      background: var(--accent);
      border: none;
      border-radius: 8px;
      width: 36px; height: 36px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 5px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    #menu-btn:hover { background: var(--accent-light); }
    #menu-btn span {
      display: block;
      width: 18px; height: 2px;
      background: #fff;
      border-radius: 2px;
      transition: transform 0.25s, opacity 0.25s;
    }
    #menu-btn.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    #menu-btn.open span:nth-child(2) { opacity: 0; }
    #menu-btn.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    #book-title {
      flex: 1;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Pagination ── */
    #pagination {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pg-btn {
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 8px;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.15s, border-color 0.15s;
      user-select: none;
    }
    .pg-btn:hover { background: var(--accent); border-color: var(--accent); }
    .pg-btn:active { transform: scale(0.93); }

    #pgNo {
      width: 44px;
      text-align: center;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
      padding: 4px 6px;
      outline: none;
      -moz-appearance: textfield;
    }
    #pgNo::-webkit-inner-spin-button,
    #pgNo::-webkit-outer-spin-button { -webkit-appearance: none; }
    #pgNo:focus { border-color: var(--accent); }

    #total-pages { font-size: 13px; color: var(--text-muted); white-space: nowrap; }

    /* ── Sidebar ── */
    #sidebar {
      position: fixed;
      top: var(--header-h);
      left: calc(-1 * var(--sidebar-w));
      width: var(--sidebar-w);
      height: calc(100% - var(--header-h));
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 150;
      transition: left 0.28s cubic-bezier(.4,0,.2,1);
      overflow: hidden;
    }
    #sidebar.open { left: 0; }

    #sidebar-header {
      padding: 18px 20px 12px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    #sidebar-header h2 {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent-light);
    }

    #toc-list {
      list-style: none;
      overflow-y: auto;
      flex: 1;
      padding: 8px 0;
    }
    #toc-list::-webkit-scrollbar { width: 4px; }
    #toc-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

    .toc-item a {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 9px 20px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13.5px;
      line-height: 1.45;
      border-left: 3px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .toc-item a:hover {
      background: var(--surface2);
      color: var(--text);
      border-left-color: var(--accent);
    }
    .toc-item.active a {
      background: rgba(99,102,241,0.15);
      color: var(--accent-light);
      border-left-color: var(--accent);
      font-weight: 600;
    }
    .toc-num {
      font-size: 11px;
      color: var(--accent);
      font-weight: 700;
      min-width: 20px;
      flex-shrink: 0;
    }

    /* ── Overlay ── */
    #overlay {
      display: none;
      position: fixed;
      inset: var(--header-h) 0 0 0;
      background: rgba(0,0,0,0.45);
      z-index: 100;
      backdrop-filter: blur(2px);
    }
    #overlay.show { display: block; }

    /* ── Content Frame ── */
    #content {
      position: fixed;
      top: var(--header-h);
      left: 0; right: 0;
      bottom: 0;
    }

    #viewerFrame {
      width: 100%;
      height: 100%;
      border: none;
      background: #fff;
    }

    /* ── Progress bar at bottom ── */
    #progress-bar {
      position: fixed;
      bottom: 0; left: 0;
      height: 3px;
      background: var(--accent);
      transition: width 0.3s ease;
      z-index: 300;
    }
  </style>
</head>
<body>

  <!-- Top bar -->
  <div id="topbar">
    <button id="menu-btn" title="Table of Contents">
      <span></span><span></span><span></span>
    </button>
    <div id="book-title">📖 EPUB Viewer</div>
    <div id="pagination">
      <div class="pg-btn" id="prev" title="Previous page">&#8592;</div>
      <input type="number" id="pgNo" min="1" value="1" />
      <span id="total-pages">/ —</span>
      <div class="pg-btn" id="next" title="Next page">&#8594;</div>
    </div>
  </div>

  <!-- Sidebar -->
  <div id="sidebar">
    <div id="sidebar-header"><h2>Table of Contents</h2></div>
    <ol id="toc-list">
      ${pageLinks}
    </ol>
  </div>

  <!-- Overlay -->
  <div id="overlay"></div>

  <!-- Viewer -->
  <div id="content">
    <iframe id="viewerFrame" src="${newfilenames[0] ?? ''}" name="main"></iframe>
  </div>

  <!-- Progress bar -->
  <div id="progress-bar"></div>

  <script src="jquery.min.js"></script>
  <script>
    var fileNames = ${JSON.stringify(newfilenames)};
    var currentPage = 1;

    function updateProgress() {
      var pct = fileNames.length > 0 ? (currentPage / fileNames.length) * 100 : 0;
      document.getElementById('progress-bar').style.width = pct + '%';
    }

    function selectPage(src, pageNo) {
      currentPage = pageNo;
      $('#pgNo').val(pageNo);
      $('#viewerFrame').attr('src', src);
      // Highlight active TOC item
      $('.toc-item').removeClass('active');
      $('.toc-item').eq(pageNo - 1).addClass('active');
      updateProgress();
      // Close sidebar on mobile
      if (window.innerWidth < 768) closeSidebar();
    }

    function openSidebar() {
      $('#sidebar').addClass('open');
      $('#menu-btn').addClass('open');
      $('#overlay').addClass('show');
    }

    function closeSidebar() {
      $('#sidebar').removeClass('open');
      $('#menu-btn').removeClass('open');
      $('#overlay').removeClass('show');
    }

    $('#menu-btn').on('click', function() {
      if ($('#sidebar').hasClass('open')) { closeSidebar(); }
      else { openSidebar(); }
    });

    $('#overlay').on('click', closeSidebar);

    $('#prev').on('click', function() {
      if (currentPage > 1) {
        currentPage--;
        $('#viewerFrame').attr('src', fileNames[currentPage - 1]);
        $('#pgNo').val(currentPage);
        $('.toc-item').removeClass('active');
        $('.toc-item').eq(currentPage - 1).addClass('active');
        updateProgress();
      }
    });

    $('#next').on('click', function() {
      if (currentPage < fileNames.length) {
        currentPage++;
        $('#viewerFrame').attr('src', fileNames[currentPage - 1]);
        $('#pgNo').val(currentPage);
        $('.toc-item').removeClass('active');
        $('.toc-item').eq(currentPage - 1).addClass('active');
        updateProgress();
      }
    });

    $('#pgNo').on('keyup', function(e) {
      if (e.key === 'Enter') {
        var val = parseInt($(this).val(), 10);
        if (val >= 1 && val <= fileNames.length) {
          selectPage(fileNames[val - 1], val);
        } else if (val > fileNames.length) {
          selectPage(fileNames[fileNames.length - 1], fileNames.length);
        }
      }
    });

    $(window).on('load', function() {
      $('#total-pages').text('/ ' + fileNames.length);
      $('.toc-item').first().addClass('active');
      updateProgress();
    });
  </script>
</body>
</html>`;
}
