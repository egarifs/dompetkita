window.AppIcons = (() => {
  const icons = {
    "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    "arrow-left-right": '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    "bell-ring": '<path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="M4 8a8 8 0 0 1 16 0c0 7 3 7 3 9H1c0-2 3-2 3-9"/><path d="M2 2c2 1.5 3 3.5 3 6"/><path d="M22 2c-2 1.5-3 3.5-3 6"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18.4 6a2 2 0 0 0-1.8-1H7.4a2 2 0 0 0-1.8 1l-2.1 5.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/><path d="M7 17h10"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    "chart-no-axes-combined": '<path d="M12 16v5"/><path d="M16 14v7"/><path d="M20 10v11"/><path d="m22 3-8.5 8.5-5-5L2 13"/><path d="M8 14v7"/>',
    "chart-pie": '<path d="M21 12c.6 0 1-.4.9-1A10 10 0 0 0 13 2.1c-.6-.1-1 .3-1 .9v8a1 1 0 0 0 1 1z"/><path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M12 12 8 2.8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-up": '<path d="m18 15-6-6-6 6"/>',
    "circle-plus": '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    "cloud-sync": '<path d="M12 13v4l3-3"/><path d="M12 17l-3-3"/><path d="M20 16.6A4.5 4.5 0 0 0 17.5 8h-1.1A7 7 0 1 0 4 14.5"/><path d="M16 18a4 4 0 0 1-7.5 2"/><path d="M8 18a4 4 0 0 1 7.5-2"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    "code-2": '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="m2 2 20 20"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a17.9 17.9 0 0 1-3.2 4.4"/><path d="M6.1 6.1A17.9 17.9 0 0 0 2 12s3.5 8 10 8a10.7 10.7 0 0 0 5.9-1.9"/>',
    "file-spreadsheet": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9v8"/><path d="M14 9v8"/>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    goal: '<path d="M12 13V2l8 4-8 4"/><path d="M20.6 10.6A9 9 0 1 1 12 3"/><path d="M15.5 15.5A5 5 0 1 1 12 7"/>',
    "heart-handshake": '<path d="M19 14c1.5-1.5 3-3.5 3-6a5 5 0 0 0-9-3 5 5 0 0 0-9 3c0 2.5 1.5 4.5 3 6l5 5z"/><path d="m12 13 2-2 3 3"/><path d="m7 14 3-3 2 2"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    home: '<path d="m3 10.5 9-7 9 7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    "layout-dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    "message-square": '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    pencil: '<path d="M21.2 6.8 17.2 2.8a2 2 0 0 0-2.8 0L3 14.2V21h6.8L21.2 9.6a2 2 0 0 0 0-2.8Z"/><path d="m14 5 5 5"/>',
    "piggy-bank": '<path d="M19 5c-1.5 0-2.8.8-3.5 2H11a6 6 0 0 0-6 6v2a3 3 0 0 0 3 3h1v3h3v-3h4v3h3v-4.2A6 6 0 0 0 21 12v-1h1V8h-2.2A3 3 0 0 0 19 5Z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>',
    "receipt-text": '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    "rotate-ccw": '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/>',
    scale: '<path d="m16 16 3-8 3 8c-.9 1.3-5.1 1.3-6 0Z"/><path d="m2 16 3-8 3 8c-.9 1.3-5.1 1.3-6 0Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/>',
    settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 1.7l-.2 1.2a8 8 0 0 0-1.7.7l-1-.7a2 2 0 0 0-2.6.3l-.3.3a2 2 0 0 0-.3 2.6l.7 1a8 8 0 0 0-.7 1.7l-1.2.2A2 2 0 0 0 2 12.8v.4a2 2 0 0 0 1.7 2l1.2.2c.2.6.4 1.2.7 1.7l-.7 1a2 2 0 0 0 .3 2.6l.3.3a2 2 0 0 0 2.6.3l1-.7c.5.3 1.1.5 1.7.7l.2 1.2a2 2 0 0 0 2 1.7h.4a2 2 0 0 0 2-1.7l.2-1.2a8 8 0 0 0 1.7-.7l1 .7a2 2 0 0 0 2.6-.3l.3-.3a2 2 0 0 0 .3-2.6l-.7-1c.3-.5.5-1.1.7-1.7l1.2-.2a2 2 0 0 0 1.7-2v-.4a2 2 0 0 0-1.7-2l-1.2-.2a8 8 0 0 0-.7-1.7l.7-1a2 2 0 0 0-.3-2.6l-.3-.3a2 2 0 0 0-2.6-.3l-1 .7a8 8 0 0 0-1.7-.7l-.2-1.2a2 2 0 0 0-2-1.7Z"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
    "share-2": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>',
    "trash-2": '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    "user-round": '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    "users-round": '<path d="M18 21a6 6 0 0 0-12 0"/><circle cx="12" cy="8" r="5"/><path d="M22 21a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M17 12h.01"/>',
    "wallet-cards": '<rect width="18" height="14" x="3" y="7" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10v4"/><path d="M3 11h18"/><path d="M7 15h.01"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18v3h3l6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-2.6z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };

  function icon(name, size = 22, className = "lucide-icon") {
    const body = icons[name] || icons["circle-plus"] || "";
    return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  function hydrate(root = document) {
    root.querySelectorAll("[data-lucide-icon]").forEach((element) => {
      const size = Number(element.dataset.iconSize || element.getAttribute("width") || 22);
      const name = element.dataset.lucideIcon;
      const classes = element.dataset.iconClass || element.className || "lucide-icon";
      element.outerHTML = icon(name, size, classes);
    });
  }

  return { icon, hydrate };
})();
