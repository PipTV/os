/*
 * Pip demo: a pretend TV behind the real web remote. The remote page is the one the TV
 * serves; this file answers its /api calls in the browser and tells the demo page what the
 * TV would show. Nothing is saved or sent anywhere.
 */
(() => {
  const APPS = [
    ["demo.movies", "Movies", "#B4232C"],
    ["demo.video", "Video", "#D93025"],
    ["demo.music", "Music", "#1E9E5A"],
    ["demo.livetv", "Live TV", "#2563EB"],
    ["demo.photos", "Photos", "#7C3AED"],
    ["demo.sports", "Sports", "#0E9AA7"],
    ["demo.kids", "Kids", "#E8920C"],
    ["demo.browser", "Browser", "#475569"],
  ].map(([pkg, label, tint]) => ({ pkg, label, tint, system: false, cat: "VIDEO", banner: false }));

  const PARAMS = { REFRACT: 12, BEZEL: 14, FROST: 7, DISPERSION: 0.12, SATURATION: 1.15, SPECULAR: 0.75, LIGHT: 235, TINT: 0.42, SHADOW: 0.3, MERGE: 8 };
  const fresh = () => ({
    t: "state", theme: "GLASS", layout: "SHELF", wallpaper: "SCENE", art: "mcdonald", city: "Istanbul", recent: "",
    saverClock: false, tiles: "ARTWORK", labels: "FOCUSED", font: "MODERN", clock: true, sounds: true, tips: true, daily: false,
    hidden: [], inputs: {}, widgets: [["DIGITAL_CLOCK", 0, 0, 4, 2], ["WEATHER", 4, 0, 3, 2]], top: [], p: { ...PARAMS },
  });
  const LAYOUTS = ["SHELF", "GRID", "SPOTLIGHT", "MOSAIC", "WIDGETS"];
  const LAYOUT_NAMES = { SHELF: "Calm", GRID: "App icons", SPOTLIGHT: "Spotlight", MOSAIC: "Mosaic", WIDGETS: "Widgets" };

  let state = fresh();
  let tv = null;
  let photo = null, wallRev = 0;
  const timers = {};
  const resetTv = () => { tv = { power: true, zone: "DOCK", index: 0, fg: "home", overlay: null, volume: 12, muted: false, hud: null, paused: false, text: "", toast: null, sound: null, keys: 0 }; };
  resetTv();

  const appOf = (pkg) => APPS.find((a) => a.pkg === pkg);
  const dock = () => {
    const picks = state.top && state.top.length ? state.top : APPS.map((a) => a.pkg);
    return picks.filter((p) => appOf(p) && !state.hidden.includes(p)).slice(0, 6);
  };
  const flash = (field, value, ms) => {
    tv[field] = value;
    clearTimeout(timers[field]);
    timers[field] = setTimeout(() => { tv[field] = null; emit(); }, ms);
  };
  const say = (msg) => flash("toast", msg, 1800);
  const nextLayout = () => {
    const i = LAYOUTS.indexOf(state.layout);
    state = { ...state, layout: LAYOUTS[(i + 1) % LAYOUTS.length] };
    say("Layout: " + LAYOUT_NAMES[state.layout]);
  };

  /* ------------------------------ keys ------------------------------ */
  function key(k) {
    tv.keys++;
    tv.sound = null;
    if (!tv.power) { if (k === "POWER") { tv.power = true; tv.sound = "select"; } return emit(); }
    const row = dock();
    switch (k) {
      case "POWER": tv.power = false; tv.overlay = null; return emit();
      case "VOL_UP": case "VOL_DOWN":
        tv.volume = Math.max(0, Math.min(30, tv.volume + (k === "VOL_UP" ? 1 : -1))); tv.muted = false; flash("hud", "volume", 1500); return emit();
      case "MUTE": tv.muted = !tv.muted; flash("hud", "volume", 1500); return emit();
      case "HOME": tv.fg = "home"; tv.overlay = null; tv.sound = "back"; return emit();
      case "BACK":
        if (tv.overlay) tv.overlay = null; else if (tv.fg !== "home") tv.fg = "home";
        tv.sound = "back"; return emit();
    }
    if (tv.fg !== "home") {
      if (k === "PLAY_PAUSE" || k === "OK") { tv.paused = !tv.paused; flash("hud", tv.paused ? "pause" : "play", 900); }
      if (k === "LEFT" || k === "RIGHT") flash("hud", k === "LEFT" ? "rewind" : "forward", 700);
      return emit();
    }
    if (k === "MENU") { nextLayout(); tv.sound = "select"; return emit(); }
    if (k === "SEARCH") { tv.overlay = "search"; tv.sound = "select"; return emit(); }
    if (tv.overlay) {
      if (k === "OK") { tv.overlay = null; tv.sound = "back"; }
      return emit();
    }
    if (k === "LEFT" || k === "RIGHT") {
      const max = tv.zone === "TOP" ? 3 : row.length - 1;
      const next = Math.max(0, Math.min(max, tv.index + (k === "LEFT" ? -1 : 1)));
      if (next !== tv.index) { tv.index = next; tv.sound = "focus"; }
    } else if (k === "UP" && tv.zone === "DOCK") { tv.zone = "TOP"; tv.index = 0; tv.sound = "focus"; }
    else if (k === "DOWN" && tv.zone === "TOP") { tv.zone = "DOCK"; tv.index = 0; tv.sound = "focus"; }
    else if (k === "OK") {
      tv.sound = "select";
      if (tv.zone === "DOCK" && row[tv.index]) open(row[tv.index]);
      else if (tv.zone === "TOP") {
        if (tv.index === 0) tv.overlay = "search";
        else if (tv.index === 1) tv.overlay = "inputs";
        else if (tv.index === 2) nextLayout();
        else tv.overlay = "quick";
      }
    }
    emit();
  }
  function open(pkg) {
    if (!appOf(pkg)) return;
    tv.fg = pkg; tv.paused = false; tv.overlay = null;
    state = { ...state, recent: pkg };
  }

  /* ------------------------- the pretend API ------------------------- */
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
  const none = () => new Response(null, { status: 204 });
  const bodyText = async (b) => (b == null ? "" : typeof b === "string" ? b : b instanceof Blob ? b.text() : String(b));
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, opts = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, opts);
    const route = (opts.method || "GET").toUpperCase() + " " + url.pathname;
    await new Promise((r) => setTimeout(r, 40)); // a little network, so it feels like a TV
    switch (route) {
      case "GET /api/hello": return json({ name: "Living room · demo", ok: true, keys: "READY", sleepTimer: false, focus: tv.zone });
      case "GET /api/state": return json(state);
      case "GET /api/apps": return json({ dock: dock(), apps: APPS });
      case "POST /api/key": key(url.searchParams.get("k")); return none();
      case "POST /api/state": {
        state = { ...state, ...JSON.parse(await bodyText(opts.body)) };
        emit(); return none();
      }
      case "POST /api/text": {
        const t = await bodyText(opts.body);
        tv.overlay = "search"; tv.text = (tv.text + " " + t).trim().slice(-60); emit(); return none();
      }
      case "POST /api/open": {
        const link = (await bodyText(opts.body)).trim().toLowerCase();
        if (!/^(https?:\/\/|www\.)/.test(link)) return new Response("That isn't a link the TV can open.", { status: 400 });
        const pkg = /youtu/.test(link) ? "demo.video" : /netflix|prime|disney|hbo|max\./.test(link) ? "demo.movies" : /spotify|music/.test(link) ? "demo.music" : "demo.browser";
        open(pkg); say("Opening your link in " + appOf(pkg).label); tv.sound = "select"; emit();
        return json({ app: appOf(pkg).label });
      }
      case "POST /api/launch": open(url.searchParams.get("pkg")); tv.sound = "select"; emit(); return none();
      case "POST /api/wallpaper": {
        const blob = opts.body instanceof Blob ? opts.body : new Blob([opts.body]);
        if (photo) URL.revokeObjectURL(photo);
        photo = URL.createObjectURL(blob); wallRev++;
        state = { ...state, wallpaper: "PHOTO" }; emit(); return none();
      }
      default: return new Response("Not in the demo.", { status: 404 });
    }
  };

  /* ---------------------- live updates, like the TV ---------------------- */
  const streams = new Set();
  class DemoEvents {
    constructor() { this.handlers = {}; this.onerror = null; streams.add(this); setTimeout(() => this.send(), 30); }
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); }
    removeEventListener(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }
    close() { streams.delete(this); }
    send() { const data = JSON.stringify(payload()); (this.handlers.state || []).forEach((fn) => fn({ data })); }
  }
  window.EventSource = DemoEvents;
  const payload = () => ({
    ...state, apps: APPS.length, wallpaperRev: wallRev, dock: dock(),
    live: { zone: tv.zone, index: tv.index, tab: 0, fg: tv.fg === "home" ? "dev.liquidglass.tv" : tv.fg, home: tv.fg === "home" },
  });
  function emit() {
    streams.forEach((s) => s.send());
    if (window.parent !== window) window.parent.postMessage({ pipDemo: "tv", state, tv, apps: APPS, dock: dock(), photo }, location.origin);
    tv.sound = null;
  }

  /* --------------------------- for the page --------------------------- */
  const iconCache = {};
  window.PIP_DEMO = {
    icon(pkg) {
      if (iconCache[pkg]) return iconCache[pkg];
      const a = appOf(pkg) || { label: "?", tint: "#555" };
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="${a.tint}"/><text x="48" y="56" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="${a.label.length > 6 ? 16 : 20}" font-weight="700" fill="#fff">${a.label}</text></svg>`;
      return (iconCache[pkg] = "data:image/svg+xml," + encodeURIComponent(svg));
    },
    photo: () => photo || "art/" + state.art + "_thumb.webp",
  };
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.pipDemo === "reset") { state = fresh(); resetTv(); photo = null; emit(); }
    if (e.data.pipDemo === "hello") emit();
  });

  // The remote reads its pairing code from the address; the demo TV accepts this one.
  if (!/[#&]t=/.test(location.hash)) history.replaceState(null, "", location.pathname + "#t=DEMO42");
})();
