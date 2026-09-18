-- CreateEnum
CREATE TYPE "TipoAviso" AS ENUM ('POSTULACION_NUEVA', 'TRANSFERENCIA_PENDIENTE', 'DONACION_VERIFICADA', 'META_ALCANZADA');

-- CreateTable
CREATE TABLE "AvisoPendiente" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAviso" NOT NULL,
    "datos" JSONB NOT NULL,
    "originadoPorEmail" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,

    CONSTRAINT "AvisoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvisoPendiente_enviadoEn_creadoEn_idx" ON "AvisoPendiente"("enviadoEn", "creadoEn");
