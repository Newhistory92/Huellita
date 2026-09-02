-- CreateEnum
CREATE TYPE "EstadoAnimal" AS ENUM ('BORRADOR', 'DISPONIBLE', 'EN_EVALUACION', 'RESERVADO', 'ADOPTADO', 'TRANSITO', 'TRATAMIENTO', 'NO_DISPONIBLE', 'FALLECIDO');

-- CreateEnum
CREATE TYPE "Especie" AS ENUM ('PERRO', 'GATO', 'OTRO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MACHO', 'HEMBRA');

-- CreateEnum
CREATE TYPE "Tamano" AS ENUM ('PEQUENO', 'MEDIANO', 'GRANDE');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRACION', 'ANIMALES', 'FINANZAS', 'REDACCION');

-- CreateEnum
CREATE TYPE "TipoAsiento" AS ENUM ('DONACION', 'GASTO', 'REEMBOLSO', 'TRANSFERENCIA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoCaso" AS ENUM ('ABIERTO', 'META_ALCANZADA', 'CERRADO');

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "especie" "Especie" NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "tamano" "Tamano" NOT NULL,
    "fechaNacimientoAprox" TIMESTAMP(3),
    "peso" INTEGER,
    "descripcion" TEXT NOT NULL,
    "personalidad" TEXT,
    "zona" TEXT,
    "transito" TEXT,
    "castrado" BOOLEAN NOT NULL DEFAULT false,
    "vacunasAlDia" BOOLEAN NOT NULL DEFAULT false,
    "requisitos" TEXT,
    "estado" "EstadoAnimal" NOT NULL DEFAULT 'BORRADOR',
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "publicadoEn" TIMESTAMP(3),
    "adoptadoEn" TIMESTAMP(3),
    "atributos" JSONB NOT NULL DEFAULT '{}',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "claveArchivo" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "sensible" BOOLEAN NOT NULL DEFAULT false,
    "ancho" INTEGER NOT NULL,
    "alto" INTEGER NOT NULL,
    "placeholder" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedireccionDireccion" (
    "slugAnterior" TEXT NOT NULL,
    "animalId" TEXT,
    "casoId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedireccionDireccion_pkey" PRIMARY KEY ("slugAnterior")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioEmail" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "ip" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoFinanciero" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "animalId" TEXT,
    "titulo" TEXT NOT NULL,
    "situacion" TEXT NOT NULL,
    "metaCentavos" BIGINT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "estado" "EstadoCaso" NOT NULL DEFAULT 'ABIERTO',
    "recibidoCentavos" BIGINT NOT NULL DEFAULT 0,
    "gastadoCentavos" BIGINT NOT NULL DEFAULT 0,
    "cantidadDonantes" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoFinanciero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsientoContable" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "tipo" "TipoAsiento" NOT NULL,
    "centavos" BIGINT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "descripcion" TEXT NOT NULL,
    "proveedor" TEXT,
    "pagoExternoId" TEXT,
    "ajustaAId" TEXT,
    "documentoId" TEXT,
    "creadoPorId" TEXT,
    "creadoPorSistema" BOOLEAN NOT NULL DEFAULT false,
    "fechaEfectiva" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsientoContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoWebhook" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "eventoExternoId" TEXT NOT NULL,
    "cargaUtil" JSONB NOT NULL,
    "procesadoEn" TIMESTAMP(3),
    "resultado" TEXT,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_slug_key" ON "Animal"("slug");

-- CreateIndex
CREATE INDEX "Animal_estado_archivado_idx" ON "Animal"("estado", "archivado");

-- CreateIndex
CREATE INDEX "Animal_especie_tamano_estado_idx" ON "Animal"("especie", "tamano", "estado");

-- CreateIndex
CREATE INDEX "FotoAnimal_animalId_orden_idx" ON "FotoAnimal"("animalId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidad_entidadId_idx" ON "RegistroAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_creadoEn_idx" ON "RegistroAuditoria"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "CasoFinanciero_slug_key" ON "CasoFinanciero"("slug");

-- CreateIndex
CREATE INDEX "AsientoContable_casoId_fechaEfectiva_idx" ON "AsientoContable"("casoId", "fechaEfectiva");

-- CreateIndex
CREATE UNIQUE INDEX "AsientoContable_proveedor_pagoExternoId_key" ON "AsientoContable"("proveedor", "pagoExternoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoWebhook_proveedor_eventoExternoId_key" ON "EventoWebhook"("proveedor", "eventoExternoId");

-- AddForeignKey
ALTER TABLE "FotoAnimal" ADD CONSTRAINT "FotoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoFinanciero" ADD CONSTRAINT "CasoFinanciero_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoContable" ADD CONSTRAINT "AsientoContable_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "CasoFinanciero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
