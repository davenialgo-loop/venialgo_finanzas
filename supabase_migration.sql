-- ============================================================
-- Migration: Add incomes, debts tables + category tipo column
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

CREATE POLICY "Users can view their own incomes"
    ON incomes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own incomes"
    ON incomes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own incomes"
    ON incomes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own incomes"
    ON incomes FOR DELETE
    USING (auth.uid() = user_id);

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

CREATE POLICY "Users can view their own debts"
    ON debts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own debts"
    ON debts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own debts"
    ON debts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own debts"
    ON debts FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_estado ON debts(estado);

-- 3. Agregar columna tipo a categories (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'categories' AND column_name = 'tipo'
    ) THEN
        ALTER TABLE categories ADD COLUMN tipo TEXT NOT NULL DEFAULT 'expense'
            CHECK (tipo IN ('expense', 'income'));
    END IF;
END $$;

-- 4. Insertar categorías de ingreso por defecto para usuarios existentes
INSERT INTO categories (user_id, name, tipo)
SELECT DISTINCT c.user_id, 'Salario', 'income'
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.user_id = c.user_id AND c2.name = 'Salario' AND c2.tipo = 'income'
);

INSERT INTO categories (user_id, name, tipo)
SELECT DISTINCT c.user_id, 'Freelance', 'income'
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.user_id = c.user_id AND c2.name = 'Freelance' AND c2.tipo = 'income'
);

INSERT INTO categories (user_id, name, tipo)
SELECT DISTINCT c.user_id, 'Inversiones', 'income'
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.user_id = c.user_id AND c2.name = 'Inversiones' AND c2.tipo = 'income'
);

INSERT INTO categories (user_id, name, tipo)
SELECT DISTINCT c.user_id, 'Regalos', 'income'
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.user_id = c.user_id AND c2.name = 'Regalos' AND c2.tipo = 'income'
);

INSERT INTO categories (user_id, name, tipo)
SELECT DISTINCT c.user_id, 'Otros', 'income'
FROM categories c
WHERE NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.user_id = c.user_id AND c2.name = 'Otros' AND c2.tipo = 'income'
);
