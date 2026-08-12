-- ============================================================
-- Migration v2: Create incomes and debts tables only
-- Las operaciones de categories ya se aplicaron en v1
-- ============================================================

-- 1. Tabla de ingresos
CREATE TABLE IF NOT EXISTS incomes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concepto TEXT NOT NULL,
    categoria TEXT NOT NULL,
    monto NUMERIC NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incomes' AND policyname = 'Users can view their own incomes') THEN
        CREATE POLICY "Users can view their own incomes" ON incomes FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incomes' AND policyname = 'Users can insert their own incomes') THEN
        CREATE POLICY "Users can insert their own incomes" ON incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incomes' AND policyname = 'Users can update their own incomes') THEN
        CREATE POLICY "Users can update their own incomes" ON incomes FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incomes' AND policyname = 'Users can delete their own incomes') THEN
        CREATE POLICY "Users can delete their own incomes" ON incomes FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_fecha ON incomes(fecha DESC);

-- 2. Tabla de deudas
CREATE TABLE IF NOT EXISTS debts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('a_pagar', 'a_cobrar')),
    monto_total NUMERIC NOT NULL CHECK (monto_total > 0),
    monto_pagado NUMERIC NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    notas TEXT DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pagada', 'cancelada')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can view their own debts') THEN
        CREATE POLICY "Users can view their own debts" ON debts FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can insert their own debts') THEN
        CREATE POLICY "Users can insert their own debts" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can update their own debts') THEN
        CREATE POLICY "Users can update their own debts" ON debts FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can delete their own debts') THEN
        CREATE POLICY "Users can delete their own debts" ON debts FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_estado ON debts(estado);

-- ============================================================
-- Migration v3: Create investments table
-- ============================================================

CREATE TABLE IF NOT EXISTS investments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo_inversion TEXT NOT NULL,
    monto_invertido NUMERIC NOT NULL CHECK (monto_invertido > 0),
    rendimiento_estimado NUMERIC DEFAULT 0,
    rendimiento_real NUMERIC DEFAULT 0,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    fecha_cobro DATE,
    estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cobrada', 'cancelada')),
    notas TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investments' AND policyname = 'Users can view their own investments') THEN
        CREATE POLICY "Users can view their own investments" ON investments FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investments' AND policyname = 'Users can insert their own investments') THEN
        CREATE POLICY "Users can insert their own investments" ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investments' AND policyname = 'Users can update their own investments') THEN
        CREATE POLICY "Users can update their own investments" ON investments FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investments' AND policyname = 'Users can delete their own investments') THEN
        CREATE POLICY "Users can delete their own investments" ON investments FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_estado ON investments(estado);
