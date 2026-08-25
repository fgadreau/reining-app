const elements = {
  overlay: document.querySelector("#overlay"),
  bar: document.querySelector("#bar"),
  logo: document.querySelector("#association-logo"),
  eyebrow: document.querySelector("#eyebrow"),
  className: document.querySelector("#class-name"),
  associationName: document.querySelector("#association-name"),
  active: document.querySelector("#active"),
  waiting: document.querySelector("#waiting"),
  lastScore: document.querySelector("#last-score"),
  takeover: document.querySelector("#sponsor-takeover"),
  takeoverTitle: document.querySelector("#takeover-title"),
  takeoverList: document.querySelector("#takeover-list"),
  sponsorRail: document.querySelector("#sponsor-rail"),
  sponsorRailLevel: document.querySelector("#sponsor-rail-level"),
  sponsorRailList: document.querySelector("#sponsor-rail-list"),
};

const selectedArena = new URLSearchParams(location.search).get("arena")?.trim() || "";
let reconnectAttempt = 0;
let reconnectTimer = null;
let sponsorTimer = null;
let sponsorSlides = [];
let sponsorIndex = 0;

function connect() {
  clearTimeout(reconnectTimer);
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/ws/viewer?kind=overlay`);

  socket.addEventListener("open", () => { reconnectAttempt = 0; });
  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot" && message.snapshot) render(message.snapshot);
    } catch (error) {
      // Keep displaying the last valid local snapshot.
    }
  });
  socket.addEventListener("close", () => {
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 15000);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  });
}

function render(snapshot) {
  const show = snapshot.show || {};
  const association = snapshot.association || {};
  const liveItem = pickLiveItem(
    snapshot.liveClasses || [],
    snapshot.livePaidWarmups || [],
    selectedArena
  );
  const neutral = show.obsOverlayMode === "neutral";
  const dragActive = Boolean(liveItem?.activeDragItem || liveItem?.dragBreak?.isActive);

  sponsorSlides = buildSponsorSlides(association.sponsorGroups || []);
  const sponsorTakeover = dragActive && !neutral && sponsorSlides.length > 0;
  const hasSponsors = sponsorSlides.length > 0;
  elements.takeover.hidden = !sponsorTakeover;
  elements.sponsorRail.hidden = sponsorTakeover || !hasSponsors;
  elements.bar.hidden = sponsorTakeover;
  elements.overlay.dataset.hasSponsors = hasSponsors ? "true" : "false";
  elements.overlay.dataset.mode = sponsorTakeover ? "sponsor-takeover" : neutral ? "neutral" : liveItem ? "live" : "waiting";

  if (sponsorTakeover) {
    startSponsorRotation(true);
    return;
  }
  if (hasSponsors) startSponsorRotation(false);
  else stopSponsorRotation();

  elements.eyebrow.textContent = neutral ? "Vous regardez" : show.name || "ShowScore local";
  elements.className.textContent = neutral
    ? show.name || "ShowScore"
    : liveItem
      ? `${liveItem.className || "Bloc"}${liveItem.classCode ? ` (${liveItem.classCode})` : ""}`
      : "En attente du prochain passage";
  elements.associationName.textContent = neutral ? association.name || "" : selectedArena || liveItem?.arena || association.name || "";
  renderLogo(association);

  if (!neutral) {
    elements.active.innerHTML = formatRun(
      dragActive ? null : liveItem?.activeRun,
      dragActive ? "Drag de surface" : "Aucun concurrent en piste"
    );
    elements.waiting.innerHTML = formatRun(
      liveItem?.activeDragItem?.nextRun || liveItem?.dragBreak?.nextRun || liveItem?.nextRun || liveItem?.secondNextRun,
      "Aucun prochain concurrent"
    );
    const lastScore = liveItem?.latestScore || (liveItem?.lastPassedRuns || []).find((run) => run.scoreTotal);
    elements.lastScore.innerHTML = formatRun(lastScore, "Aucun pointage", true);
  }
}

function pickLiveItem(classes, warmups, arena) {
  const normalizedArena = normalize(arena);
  const items = [
    ...classes,
    ...warmups.map((warmup) => ({
      ...warmup,
      className: warmup.name || "Paid warm up",
      activeRun: warmup.activeEntry || warmup.stagedEntry,
      nextRun: warmup.nextEntry,
      secondNextRun: warmup.secondNextEntry,
    })),
  ];
  const eligible = normalizedArena
    ? items.filter((item) => normalize(item?.arena) === normalizedArena)
    : items;
  return eligible.find((item) => item.activeDragItem || item.dragBreak?.isActive)
    || eligible.find((item) => item.activeRun)
    || eligible.find((item) => item.nextRun)
    || eligible[0]
    || null;
}

function formatRun(run, fallback, includeScore = false) {
  if (!run) return escapeHtml(fallback);
  if (run.identityHidden) return `#${escapeHtml(run.draw || "—")}<small>Identité masquée</small>`;
  const primary = [run.draw ? `#${run.draw}` : "", run.rider].filter(Boolean).join(" · ");
  const secondary = [run.backNumber ? `Dossard ${run.backNumber}` : "", run.horse].filter(Boolean).join(" · ");
  return `${escapeHtml(primary || fallback)}${includeScore && run.scoreTotal ? `<strong>${escapeHtml(run.scoreTotal)}</strong>` : ""}${secondary ? `<small>${escapeHtml(secondary)}</small>` : ""}`;
}

function renderLogo(association) {
  elements.logo.replaceChildren();
  if (association.logoDataUrl) {
    const image = document.createElement("img");
    image.src = association.logoDataUrl;
    image.alt = association.name || "Association";
    elements.logo.append(image);
    return;
  }
  elements.logo.textContent = association.shortName || initials(association.name) || "SS";
}

function buildSponsorSlides(groups) {
  return groups.flatMap((group) => {
    const logos = Array.isArray(group.logos) ? group.logos.filter((logo) => logo.logoDataUrl) : [];
    const slides = [];
    for (let index = 0; index < logos.length; index += 2) {
      slides.push({ name: group.name || "", logos: logos.slice(index, index + 2) });
    }
    return slides;
  });
}

function startSponsorRotation(isTakeover) {
  clearInterval(sponsorTimer);
  const draw = () => {
    const slide = sponsorSlides[sponsorIndex % sponsorSlides.length];
    const target = isTakeover ? elements.takeoverList : elements.sponsorRailList;
    if (isTakeover) {
      elements.takeoverTitle.textContent = slide.name
        ? `Merci à nos commanditaires · ${slide.name}`
        : "Merci à nos commanditaires";
    } else {
      elements.sponsorRailLevel.textContent = slide.name || "";
    }
    target.style.setProperty("--sponsor-count", Math.min(slide.logos.length, 2));
    target.replaceChildren(...slide.logos.map((logo) => {
      const tile = document.createElement("div");
      tile.className = isTakeover ? "takeover__sponsor" : "sponsor-rail__sponsor";
      const image = document.createElement("img");
      image.src = logo.logoDataUrl;
      image.alt = logo.name || "Commanditaire";
      tile.append(image);
      return tile;
    }));
    sponsorIndex += 1;
  };
  draw();
  if (sponsorSlides.length > 1) sponsorTimer = setInterval(draw, 8000);
}

function stopSponsorRotation() {
  clearInterval(sponsorTimer);
  sponsorTimer = null;
}

function normalize(value) { return String(value || "").replace(/\s+/g, " ").trim().toLowerCase(); }
function initials(value) { return String(value || "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase(); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }

connect();
