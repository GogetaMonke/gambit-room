// Entry point Cloudflare runs on every request.
// For now this just hands everything to the static site (the "assets" binding).
// Later phases will add a route here that upgrades WebSocket requests and
// forwards them to a room's Durable Object instead.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
