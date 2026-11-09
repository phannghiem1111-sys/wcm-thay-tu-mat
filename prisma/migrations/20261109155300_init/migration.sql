-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'DOI_TRUONG', 'NHA_THAU', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."StoreStatus" AS ENUM ('CHUA_CAP_NHAT', 'CHUA_XUAT_KHO', 'DANG_VAN_CHUYEN', 'DA_DEN_CH', 'DANG_LAP', 'HOAN_THANH', 'DA_NGHIEM_THU');

-- CreateEnum
CREATE TYPE "public"."DateField" AS ENUM ('VC_DU_KIEN', 'VC_THUC_TE', 'LAP_DU_KIEN', 'LAP_THUC_TE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Store" (
    "id" TEXT NOT NULL,
    "stt" INTEGER,
    "phuTrachKhuVuc" TEXT,
    "tinh" TEXT,
    "thangKhaiTruong" DATE,
    "site" TEXT NOT NULL,
    "tenCuaHang" TEXT NOT NULL,
    "tinhCu" TEXT,
    "quanHuyenCu" TEXT,
    "cht" TEXT,
    "sdtCht" TEXT,
    "hienTrangMayNen" TEXT,
    "doiTruongKtkv" TEXT,
    "ktkv" TEXT,
    "nhaThauLapDat" TEXT,
    "nhaThauVanChuyen" TEXT,
    "kmDenCh" DECIMAL(10,1),
    "ngayVcDuKien" DATE,
    "ngayVcThucTe" DATE,
    "ngayLapDuKien" DATE,
    "ngayLapThucTe" DATE,
    "trangThai" "public"."StoreStatus" NOT NULL DEFAULT 'CHUA_CAP_NHAT',
    "maTsXuatKho" TEXT,
    "tenVatTu" TEXT,
    "article" TEXT,
    "nhaCungCap" TEXT,
    "model" TEXT,
    "serialGoc" TEXT,
    "serialThucTe" TEXT,
    "xuatXu" TEXT,
    "dvt" TEXT,
    "soLuong" INTEGER NOT NULL DEFAULT 1,
    "donGiaTaiSan" BIGINT NOT NULL DEFAULT 0,
    "donGiaVanChuyen" BIGINT NOT NULL DEFAULT 0,
    "donGiaLapDat" BIGINT NOT NULL DEFAULT 0,
    "ghiChu" TEXT,
    "linkHoSo" TEXT,
    "ngayCapNhat" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreAssignment" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAssignment_pkey" PRIMARY KEY ("userId","storeId")
);

-- CreateTable
CREATE TABLE "public"."DateConfirmation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "field" "public"."DateField" NOT NULL,
    "valueAsIs" DATE,
    "valueSwapped" DATE,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DateConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "storeId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Photo" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Store_site_key" ON "public"."Store"("site");

-- CreateIndex
CREATE INDEX "Store_tinh_idx" ON "public"."Store"("tinh");

-- CreateIndex
CREATE INDEX "Store_trangThai_idx" ON "public"."Store"("trangThai");

-- CreateIndex
CREATE INDEX "Store_doiTruongKtkv_idx" ON "public"."Store"("doiTruongKtkv");

-- CreateIndex
CREATE INDEX "Store_ngayLapDuKien_idx" ON "public"."Store"("ngayLapDuKien");

-- CreateIndex
CREATE INDEX "StoreAssignment_storeId_idx" ON "public"."StoreAssignment"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "DateConfirmation_storeId_field_key" ON "public"."DateConfirmation"("storeId", "field");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_createdAt_idx" ON "public"."AuditLog"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_key_key" ON "public"."Photo"("key");

-- CreateIndex
CREATE INDEX "Photo_storeId_idx" ON "public"."Photo"("storeId");

-- AddForeignKey
ALTER TABLE "public"."StoreAssignment" ADD CONSTRAINT "StoreAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StoreAssignment" ADD CONSTRAINT "StoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DateConfirmation" ADD CONSTRAINT "DateConfirmation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Photo" ADD CONSTRAINT "Photo_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Photo" ADD CONSTRAINT "Photo_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
