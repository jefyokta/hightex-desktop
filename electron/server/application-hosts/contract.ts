export abstract class Router {
  abstract handle(url: URL): Promisable<Response>;

  abort(status: number) {
    return new Response("Aborted", { status });
  }
  notFound() {
    return new Response("Not Found", { status: 404 });
  }
}
