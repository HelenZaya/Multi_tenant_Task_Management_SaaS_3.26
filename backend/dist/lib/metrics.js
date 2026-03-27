import client from "prom-client";
client.collectDefaultMetrics();
export const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests",
    labelNames: ["method", "route", "status_code"]
});
export async function metricsHandler(_req, res) {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
}
