// Esquema da base de dados e permissões do utilizador da aplicação. Todas as instruções podem correr várias vezes.

export const UTILIZADOR_APP = "app_reservas";
export const PRIVILEGIOS_APP = Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]);
const PRIVILEGIOS_PROIBIDOS = Object.freeze(["TRUNCATE", "REFERENCES", "TRIGGER"]);
const TABELAS_APP = Object.freeze(["salas", "reservas"]);

export const SALAS_INICIAIS = Object.freeze([
  Object.freeze({ nome: "Sala A", capacidade: 6 }),
  Object.freeze({ nome: "Sala B", capacidade: 10 }),
  Object.freeze({ nome: "Sala C", capacidade: 20 }),
]);

const PERMISSOES_SQL = `
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM ${UTILIZADOR_APP};
GRANT USAGE ON SCHEMA public TO ${UTILIZADOR_APP};
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${UTILIZADOR_APP};
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${UTILIZADOR_APP};
GRANT ${PRIVILEGIOS_APP.join(", ")} ON ${TABELAS_APP.join(", ")} TO ${UTILIZADOR_APP};
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM ${UTILIZADOR_APP}', current_database());
  EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${UTILIZADOR_APP}', current_database());
END
$$`.trim();

/**
 * Instruções da migração, pela ordem em que correm (numa só transação).
 * As regras do domínio são repetidas na base de dados como proteção extra; a de sobreposição é a única que impede
 * duas reservas em simultâneo de passarem ambas a verificação da aplicação.
 */
export const INSTRUCOES_MIGRACAO = Object.freeze([
  {
    descricao: "extensão btree_gist (necessária para impedir reservas sobrepostas)",
    sql: "CREATE EXTENSION IF NOT EXISTS btree_gist",
  },
  {
    descricao: "tabela salas",
    sql: `
CREATE TABLE IF NOT EXISTS salas (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text    NOT NULL UNIQUE,
  capacidade integer NOT NULL CHECK (capacidade >= 1)
)`.trim(),
  },
  {
    descricao: "tabela reservas",
    sql: `
CREATE TABLE IF NOT EXISTS reservas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id        uuid        NOT NULL REFERENCES salas (id) ON DELETE RESTRICT,
  inicio         timestamptz NOT NULL,
  fim            timestamptz NOT NULL,
  numero_pessoas integer     NOT NULL CHECK (numero_pessoas >= 1),
  CONSTRAINT reservas_fim_depois_do_inicio CHECK (fim > inicio),
  CONSTRAINT reservas_duracao_maxima CHECK (fim - inicio <= interval '2 hours'),
  CONSTRAINT reservas_sem_sobreposicao EXCLUDE USING gist (sala_id WITH =, tstzrange(inicio, fim, '[)') WITH &&)
)`.trim(),
  },
  {
    descricao: "salas de exemplo (Sala A, Sala B, Sala C)",
    sql: `
INSERT INTO salas (nome, capacidade)
SELECT * FROM unnest($1::text[], $2::integer[])
ON CONFLICT (nome) DO NOTHING`.trim(),
    parametros: [SALAS_INICIAIS.map((sala) => sala.nome), SALAS_INICIAIS.map((sala) => sala.capacidade)],
    contaSalasCriadas: true,
  },
  {
    descricao: `permissões de ${UTILIZADOR_APP} (só ${PRIVILEGIOS_APP.join(", ")} em ${TABELAS_APP.join(" e ")})`,
    sql: PERMISSOES_SQL,
  },
]);

export const CONSULTA_UTILIZADOR_APP_EXISTE = "SELECT 1 AS existe FROM pg_roles WHERE rolname = $1";

export const CONSULTA_ATRIBUTOS_APP =
  "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = $1";

export const CONSULTA_GRUPOS_APP = `
SELECT g.rolname AS grupo
FROM pg_auth_members m
JOIN pg_roles u ON u.oid = m.member
JOIN pg_roles g ON g.oid = m.roleid
WHERE u.rolname = $1
ORDER BY g.rolname`.trim();

// Permissões efetivas de app_reservas (contando com as que herda de PUBLIC e de grupos): nome → tem de ser true/false.
export const PRIVILEGIOS_ESPERADOS = Object.freeze({
  ...Object.fromEntries(TABELAS_APP.flatMap((tabela) => PRIVILEGIOS_APP.map((privilegio) => [`${tabela} ${privilegio}`, true]))),
  ...Object.fromEntries(TABELAS_APP.flatMap((tabela) => PRIVILEGIOS_PROIBIDOS.map((privilegio) => [`${tabela} ${privilegio}`, false]))),
  "esquema public USAGE": true,
  "esquema public CREATE": false,
  "base de dados CONNECT": true,
  "base de dados CREATE": false,
  "base de dados TEMPORARY": false,
});

export const VERIFICACAO_PRIVILEGIOS = `
SELECT t.tabela || ' ' || p.privilegio AS nome, has_table_privilege($1, 'public.' || t.tabela, p.privilegio) AS tem
FROM unnest(ARRAY['${TABELAS_APP.join("', '")}']) AS t (tabela)
CROSS JOIN unnest(ARRAY['${[...PRIVILEGIOS_APP, ...PRIVILEGIOS_PROIBIDOS].join("', '")}']) AS p (privilegio)
UNION ALL SELECT 'esquema public USAGE', has_schema_privilege($1, 'public', 'USAGE')
UNION ALL SELECT 'esquema public CREATE', has_schema_privilege($1, 'public', 'CREATE')
UNION ALL SELECT 'base de dados CONNECT', has_database_privilege($1, current_database(), 'CONNECT')
UNION ALL SELECT 'base de dados CREATE', has_database_privilege($1, current_database(), 'CREATE')
UNION ALL SELECT 'base de dados TEMPORARY', has_database_privilege($1, current_database(), 'TEMPORARY')`.trim();
