// API REST sencilla de Tareas (To-Do) con Bun
// Ejecutar: bun run server.ts
// Probar:  http://localhost:3000/tareas

interface Tarea {
  id: number;
  titulo: string;
  completada: boolean;
}

// "Base de datos" en memoria (se reinicia al reiniciar el servidor)
const tareas: Tarea[] = [
  { id: 1, titulo: "Aprender Bun", completada: false },
  { id: 2, titulo: "Probar la API con Postman", completada: false },
];

let siguienteId = 3;

// ── Registro de métricas para Power BI ─────────────────────────────
// Cada petición se guarda en metrics.csv con: fecha, método, ruta,
// código de estado y latencia en ms.
import { appendFileSync } from "node:fs";

const METRICS_FILE = new URL("./metrics.csv", import.meta.url).pathname;

function registrarMetrica(method: string, ruta: string, status: number, latenciaMs: number) {
  // Formato "YYYY-MM-DD HH:MM:SS" (compatible con Power BI, sin zona horaria)
  const fecha = new Date().toISOString().slice(0, 19).replace("T", " ");
  appendFileSync(METRICS_FILE, `${fecha},${method},${ruta},${status},${latenciaMs}\n`);
}

const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    const inicio = performance.now();
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Cabeceras comunes para todas las respuestas
    const json = (data: unknown, status = 200) => {
      registrarMetrica(method, pathname, status, Math.round(performance.now() - inicio));
      return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    };

    // GET /tareas — listar todas
    if (pathname === "/tareas" && method === "GET") {
      return json(tareas);
    }

    // GET /tareas/:id — obtener una
    const matchId = pathname.match(/^\/tareas\/(\d+)$/);
    if (matchId && method === "GET") {
      const tarea = tareas.find((t) => t.id === Number(matchId[1]));
      if (!tarea) return json({ error: "Tarea no encontrada" }, 404);
      return json(tarea);
    }

    // POST /tareas — crear
    if (pathname === "/tareas" && method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.titulo !== "string" || !body.titulo.trim()) {
        return json({ error: "El campo 'titulo' es obligatorio" }, 400);
      }
      const nueva: Tarea = {
        id: siguienteId++,
        titulo: body.titulo.trim(),
        completada: Boolean(body.completada ?? false),
      };
      tareas.push(nueva);
      return json(nueva, 201);
    }

    // PUT /tareas/:id — actualizar
    if (matchId && method === "PUT") {
      const tarea = tareas.find((t) => t.id === Number(matchId[1]));
      if (!tarea) return json({ error: "Tarea no encontrada" }, 404);

      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "Cuerpo JSON inválido" }, 400);

      if (typeof body.titulo === "string") tarea.titulo = body.titulo.trim();
      if (typeof body.completada === "boolean") tarea.completada = body.completada;
      return json(tarea);
    }

    // DELETE /tareas/:id — eliminar
    if (matchId && method === "DELETE") {
      const index = tareas.findIndex((t) => t.id === Number(matchId[1]));
      if (index === -1) return json({ error: "Tarea no encontrada" }, 404);
      const [eliminada] = tareas.splice(index, 1);
      return json({ mensaje: "Tarea eliminada", tarea: eliminada });
    }

    // Ruta raíz de bienvenida
    if (pathname === "/" && method === "GET") {
      return json({
        mensaje: "API de Tareas 🚀",
        endpoints: {
          "GET /tareas": "Listar todas",
          "GET /tareas/:id": "Obtener una",
          "POST /tareas": "Crear (body: { titulo, completada? })",
          "PUT /tareas/:id": "Actualizar",
          "DELETE /tareas/:id": "Eliminar",
        },
      });
    }

    return json({ error: "Ruta no encontrada" }, 404);
  },
});

console.log(`✅ API corriendo en http://localhost:${server.port}`);
