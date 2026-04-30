-- CreateEnum
CREATE TYPE "evaluation_score" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE');

-- CreateTable
CREATE TABLE "evaluation_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title_ar" TEXT NOT NULL,
    "description_ar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "final_grade" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_evaluation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluation_id" UUID NOT NULL,
    "criteria_id" UUID NOT NULL,
    "score" "evaluation_score" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "employee_evaluation_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluations" ADD CONSTRAINT "employee_evaluations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluation_items" ADD CONSTRAINT "employee_evaluation_items_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "employee_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_evaluation_items" ADD CONSTRAINT "employee_evaluation_items_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "evaluation_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
