-- CreateTable
CREATE TABLE "Novedad" (
    "id" TEXT NOT NULL,
    "casoId" TEXT,
    "animalId" TEXT,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "fotoClave" TEXT,
    "fotoAlt" TEXT,
    "fotoAncho" INTEGER,
    "fotoAlto" INTEGER,
    "fotoPlaceholder" TEXT,
    "documentoId" TEXT,
    "autorEmail" TEXT NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Novedad_casoId_creadoEn_idx" ON "Novedad"("casoId", "creadoEn");

-- CreateIndex
CREATE INDEX "Novedad_animalId_creadoEn_idx" ON "Novedad"("animalId", "creadoEn");

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "CasoFinanciero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
