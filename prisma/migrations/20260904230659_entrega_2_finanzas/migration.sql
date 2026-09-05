-- CreateEnum
CREATE TYPE "public"."EstadoIntencion" AS ENUM ('INICIADA', 'PENDIENTE_VERIFICACION', 'APROBADA', 'RECHAZADA', 'ABANDONADA');

-- CreateTable
CREATE TABLE "public"."IntencionDonacion" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "centavos" BIGINT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "nombreDonante" TEXT,
    "publicarNombre" BOOLEAN NOT NULL DEFAULT false,
    "mensaje" TEXT,
    "proveedor" TEXT NOT NULL,
    "estado" "public"."EstadoIntencion" NOT NULL DEFAULT 'INICIADA',
    "referenciaExterna" TEXT,
    "pagoExternoId" TEXT,
    "comprobanteId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "IntencionDonacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Documento" (
    "id" TEXT NOT NULL,
    "claveArchivo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "datosPersonalesTachados" BOOLEAN NOT NULL DEFAULT false,
    "subidoPorEmail" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."AsientoContable" ADD COLUMN "intencionId" TEXT,
ADD COLUMN "contraparteId" TEXT;

-- CreateIndex
CREATE INDEX "IntencionDonacion_casoId_estado_idx" ON "public"."IntencionDonacion"("casoId" ASC, "estado" ASC);

-- CreateIndex
CREATE INDEX "IntencionDonacion_proveedor_pagoExternoId_idx" ON "public"."IntencionDonacion"("proveedor" ASC, "pagoExternoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AsientoContable_intencionId_key" ON "public"."AsientoContable"("intencionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AsientoContable_contraparteId_key" ON "public"."AsientoContable"("contraparteId" ASC);

-- AddForeignKey
ALTER TABLE "public"."IntencionDonacion" ADD CONSTRAINT "IntencionDonacion_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "public"."CasoFinanciero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AsientoContable" ADD CONSTRAINT "AsientoContable_intencionId_fkey" FOREIGN KEY ("intencionId") REFERENCES "public"."IntencionDonacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AsientoContable" ADD CONSTRAINT "AsientoContable_contraparteId_fkey" FOREIGN KEY ("contraparteId") REFERENCES "public"."AsientoContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
