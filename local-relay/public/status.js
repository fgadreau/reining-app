const relayVersion = document.querySelector("#relay-version");
const producer = document.querySelector("#producer");
const overlayViewers = document.querySelector("#overlay-viewers");
const tvViewers = document.querySelector("#tv-viewers");
const updated = document.querySelector("#updated");
const videoStatus = document.querySelector("#video-status");
const urls = document.querySelector("#urls");
const tvUrls = document.querySelector("#tv-urls");

async function refresh() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const status = await response.json();
    relayVersion.textContent = status.relayVersion || "Inconnue";
    producer.textContent = status.producerConnected ? "Connecté" : "En attente";
    overlayViewers.textContent = String(status.overlayViewerCount || 0);
    tvViewers.textContent = String(status.tvViewerCount || 0);
    updated.textContent = status.lastReceivedAt ? new Date(status.lastReceivedAt).toLocaleTimeString("fr-CA") : "Aucune donnée";
    videoStatus.textContent = formatVideoStatus(status.competitionVideo);
    urls.replaceChildren(...(status.overlayUrls || []).map((url) => {
      const link = document.createElement("a");
      link.href = url;
      link.textContent = url;
      return link;
    }));
    tvUrls.replaceChildren(...(status.tvUrls || []).map((item) => {
      const link = document.createElement("a");
      link.href = item.url;
      link.textContent = `${getTvLabel(item)} · ${item.url}`;
      return link;
    }));
  } catch (error) {
    producer.textContent = "Relais indisponible";
  }
}

function formatVideoStatus(video) {
  if (video?.status === "ready") return "Prête";
  if (video?.status === "downloading") return "Téléchargement…";
  if (video?.status === "error") return "Erreur";
  return "Non configurée";
}

function getTvLabel(item) {
  if (item.kind === "competition") return `Compétition · ${item.arena}`;
  if (item.kind === "standings") return item.arena ? `Classement · ${item.arena}` : "Classement général";
  if (item.kind === "arena") return `Manège · ${item.arena}`;
  return "Vue générale";
}

refresh();
setInterval(refresh, 2000);
