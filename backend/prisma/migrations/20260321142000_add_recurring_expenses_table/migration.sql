-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Operacao',
    "dueDay" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Em uso',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_dueDay_idx" ON "RecurringExpense"("userId", "dueDay");

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Security hardening for Supabase
ALTER TABLE public."RecurringExpense" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."RecurringExpense" FROM anon;

DROP POLICY IF EXISTS "recurring_expense_select_own" ON public."RecurringExpense";
CREATE POLICY "recurring_expense_select_own"
  ON public."RecurringExpense"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "recurring_expense_insert_own" ON public."RecurringExpense";
CREATE POLICY "recurring_expense_insert_own"
  ON public."RecurringExpense"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "recurring_expense_update_own" ON public."RecurringExpense";
CREATE POLICY "recurring_expense_update_own"
  ON public."RecurringExpense"
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "recurring_expense_delete_own" ON public."RecurringExpense";
CREATE POLICY "recurring_expense_delete_own"
  ON public."RecurringExpense"
  FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);
