-- CreateEnum
CREATE TYPE "TipoRespuesta" AS ENUM ('TEXTO_CORTO', 'TEXTO_LARGO', 'SI_NO', 'OPCION_MULTIPLE', 'SELECCION_MULTIPLE', 'NUMERO', 'EMAIL', 'TELEFONO');

-- CreateEnum
CREATE TYPE "EstadoPostulacion" AS ENUM ('NUEVA', 'EN_REVISION', 'CONTACTADA', 'ENTREVISTA', 'APROBADA', 'RECHAZADA', 'ADOPCION_CONCRETADA');

-- CreateTable
CREATE TABLE "FormularioAdopcion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Formulario base',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormularioAdopcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreguntaFormulario" (
    "id" TEXT NOT NULL,
    "formularioId" TEXT,
    "animalId" TEXT,
    "texto" TEXT NOT NULL,
    "ayuda" TEXT,
    "tipo" "TipoRespuesta" NOT NULL,
    "opciones" TEXT[],
    "obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreguntaFormulario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postulacion" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "estado" "EstadoPostulacion" NOT NULL DEFAULT 'NUEVA',
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "anonimizadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespuestaPostulacion" (
    "id" TEXT NOT NULL,
    "postulacionId" TEXT NOT NULL,
    "preguntaId" TEXT,
    "textoPregunta" TEXT NOT NULL,
    "tipo" "TipoRespuesta" NOT NULL,
    "valor" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "RespuestaPostulacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreguntaFormulario_formularioId_orden_idx" ON "PreguntaFormulario"("formularioId", "orden");

-- CreateIndex
CREATE INDEX "PreguntaFormulario_animalId_orden_idx" ON "PreguntaFormulario"("animalId", "orden");

-- CreateIndex
CREATE INDEX "Postulacion_animalId_estado_idx" ON "Postulacion"("animalId", "estado");

-- CreateIndex
CREATE INDEX "Postulacion_estado_creadoEn_idx" ON "Postulacion"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "Postulacion_animalId_email_creadoEn_idx" ON "Postulacion"("animalId", "email", "creadoEn");

-- CreateIndex
CREATE INDEX "RespuestaPostulacion_postulacionId_orden_idx" ON "RespuestaPostulacion"("postulacionId", "orden");

-- AddForeignKey
ALTER TABLE "PreguntaFormulario" ADD CONSTRAINT "PreguntaFormulario_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "FormularioAdopcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreguntaFormulario" ADD CONSTRAINT "PreguntaFormulario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaPostulacion" ADD CONSTRAINT "RespuestaPostulacion_postulacionId_fkey" FOREIGN KEY ("postulacionId") REFERENCES "Postulacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
