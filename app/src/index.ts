const serviceStatus = {
  service: "edgeflags",
  status: "ok",
};

export default {
  fetch(request): Response {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json(serviceStatus);
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
