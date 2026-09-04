import { describe, it, expect, afterEach } from "vitest";
import { hayAlmacenEnLaNubeConfigurado, faltantesDeConfiguracion } from "@/infra/almacen/configuracion";

const CLAVES = [
  "ALMACEN_S3_ENDPOINT",
  "ALMACEN_S3_BUCKET",
  "ALMACEN_S3_CLAVE",
  "ALMACEN_S3_SECRETO",
] as const;

const original = Object.fromEntries(CLAVES.map((c) => [c, process.env[c]]));

function configurarTodo() {
  process.env.ALMACEN_S3_ENDPOINT = "https://cuenta.r2.cloudflarestorage.com";
  process.env.ALMACEN_S3_BUCKET = "huellas";
  process.env.ALMACEN_S3_CLAVE = "clave";
  process.env.ALMACEN_S3_SECRETO = "secreto";
}

afterEach(() => {
  for (const c of CLAVES) {
    if (original[c] === undefined) delete process.env[c];
    else process.env[c] = original[c];
  }
});

describe("elección del almacén", () => {
  it("sin configuración usa el disco local", () => {
    for (const c of CLAVES) delete process.env[c];
    expect(hayAlmacenEnLaNubeConfigurado()).toBe(false);
  });

  it("con las cuatro variables usa la nube", () => {
    configurarTodo();
    expect(hayAlmacenEnLaNubeConfigurado()).toBe(true);
  });

  // Una configuración a medias es el caso peligroso: la aplicación arrancaría
  // guardando en el disco de un servidor que se borra en cada despliegue, sin
  // que nadie se entere hasta que las fotos desaparecen.
  it("una configuración incompleta no se toma por buena", () => {
    configurarTodo();
    delete process.env.ALMACEN_S3_SECRETO;
    expect(hayAlmacenEnLaNubeConfigurado()).toBe(false);
  });

  it("informa cuáles faltan, para que el error diga qué hacer", () => {
    configurarTodo();
    delete process.env.ALMACEN_S3_SECRETO;
    delete process.env.ALMACEN_S3_BUCKET;
    expect(faltantesDeConfiguracion().sort()).toEqual(["ALMACEN_S3_BUCKET", "ALMACEN_S3_SECRETO"]);
  });

  it("una variable en blanco cuenta como ausente", () => {
    configurarTodo();
    process.env.ALMACEN_S3_BUCKET = "   ";
    expect(hayAlmacenEnLaNubeConfigurado()).toBe(false);
  });
});
