const serviceStatus = {
  service: "edgeflags",
  status: "ok",
};

export function handleGetServiceStatus(): Response {
  return Response.json(serviceStatus);
}
