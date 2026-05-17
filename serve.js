import http from "http";
import fs from "fs";
import path from "path";

const root = process.cwd();
const port = 4173;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, relativePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Proibido");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Não encontrado");
      return;
    }

    response.writeHead(200, {
      "Content-Type":
        mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8",
    });
    response.end(content);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `Calculadora de salário líquido disponível em http://127.0.0.1:${port}`,
  );
});
