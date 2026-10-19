import { describe, expect, it } from "vitest";
import { INSTRUCOES_MIGRACAO, PRIVILEGIOS_APP, SALAS_INICIAIS, UTILIZADOR_APP } from "./esquema.js";

const SQL = INSTRUCOES_MIGRACAO.map((instrucao) => instrucao.sql).join("\n;\n");

function sqlDe(descricao) {
  const instrucao = INSTRUCOES_MIGRACAO.find((candidata) => candidata.descricao.includes(descricao));
  expect(instrucao, `instrução "${descricao}"`).toBeDefined();
  return instrucao.sql;
}

describe("esquema — tabelas", () => {
  it("cria a tabela de salas com UUID gerado pela base de dados e nome único", () => {
    const sql = sqlDe("tabela salas");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS salas/);
    expect(sql).toMatch(/id\s+uuid\s+PRIMARY KEY\s+DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/nome\s+text\s+NOT NULL\s+UNIQUE/);
    expect(sql).toMatch(/capacidade\s+integer\s+NOT NULL\s+CHECK \(capacidade >= 1\)/);
  });

  it("cria a tabela de reservas com UUID, ligação à sala e datas TIMESTAMPTZ", () => {
    const sql = sqlDe("tabela reservas");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS reservas/);
    expect(sql).toMatch(/id\s+uuid\s+PRIMARY KEY\s+DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/sala_id\s+uuid\s+NOT NULL\s+REFERENCES salas \(id\)/);
    expect(sql).toMatch(/inicio\s+timestamptz\s+NOT NULL/);
    expect(sql).toMatch(/fim\s+timestamptz\s+NOT NULL/);
    expect(sql).toMatch(/numero_pessoas\s+integer\s+NOT NULL\s+CHECK \(numero_pessoas >= 1\)/);
  });

  it("não usa datas sem fuso horário", () => {
    expect(SQL).not.toMatch(/\btimestamp\b(?!tz)/i);
  });

  it("protege as regras do domínio também na base de dados", () => {
    const sql = sqlDe("tabela reservas");
    expect(sql).toMatch(/CHECK \(fim > inicio\)/);
    expect(sql).toMatch(/CHECK \(fim - inicio <= interval '2 hours'\)/);
    // Reservas da mesma sala não se sobrepõem; intervalos [inicio, fim): reservas seguidas são permitidas.
    expect(sql).toMatch(/EXCLUDE USING gist \(sala_id WITH =, tstzrange\(inicio, fim, '\[\)'\) WITH &&\)/);
    expect(sqlDe("extensão btree_gist")).toMatch(/CREATE EXTENSION IF NOT EXISTS btree_gist/);
  });
});

describe("esquema — pode correr várias vezes", () => {
  it("todas as criações usam IF NOT EXISTS", () => {
    for (const { sql } of INSTRUCOES_MIGRACAO) {
      for (const criacao of sql.match(/CREATE (TABLE|EXTENSION|INDEX)[^\n]*/g) ?? []) {
        expect(criacao).toContain("IF NOT EXISTS");
      }
    }
  });

  it("insere as salas de exemplo sem as repetir (ON CONFLICT pelo nome)", () => {
    const sql = sqlDe("salas de exemplo");
    expect(sql).toMatch(/INSERT INTO salas \(nome, capacidade\)/);
    expect(sql).toMatch(/ON CONFLICT \(nome\) DO NOTHING/);
    expect(SALAS_INICIAIS.map((sala) => sala.nome)).toEqual(["Sala A", "Sala B", "Sala C"]);
  });

  it("passa os dados das salas como parâmetros, não colados no SQL", () => {
    const instrucao = INSTRUCOES_MIGRACAO.find((candidata) => candidata.descricao.includes("salas de exemplo"));
    expect(instrucao.parametros).toEqual([["Sala A", "Sala B", "Sala C"], SALAS_INICIAIS.map((sala) => sala.capacidade)]);
    expect(instrucao.sql).not.toContain("Sala A");
  });

  it("não apaga nada", () => {
    expect(SQL).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/i);
  });
});

describe("esquema — permissões do utilizador app_reservas", () => {
  it("só lê, insere, altera e apaga dados", () => {
    expect(UTILIZADOR_APP).toBe("app_reservas");
    expect(PRIVILEGIOS_APP).toEqual(["SELECT", "INSERT", "UPDATE", "DELETE"]);
  });

  it("retira primeiro tudo e depois dá só esses privilégios nas duas tabelas", () => {
    const sql = sqlDe("permissões");
    const indiceRevoke = sql.indexOf("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_reservas");
    const indiceGrant = sql.indexOf("GRANT SELECT, INSERT, UPDATE, DELETE ON salas, reservas TO app_reservas");
    expect(indiceRevoke).toBeGreaterThanOrEqual(0);
    expect(indiceGrant).toBeGreaterThan(indiceRevoke);
    expect(sql).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_reservas");
  });

  it("não pode criar objetos no esquema nem tabelas temporárias na base de dados", () => {
    const sql = sqlDe("permissões");
    expect(sql).toContain("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    expect(sql).toContain("REVOKE CREATE ON SCHEMA public FROM app_reservas");
    expect(sql).toContain("GRANT USAGE ON SCHEMA public TO app_reservas");
    expect(sql).toMatch(/REVOKE ALL ON DATABASE %I FROM app_reservas/);
    expect(sql).toMatch(/REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC/);
    expect(sql).toMatch(/GRANT CONNECT ON DATABASE %I TO app_reservas/);
  });

  it("nunca dá privilégios a mais", () => {
    expect(SQL).not.toMatch(/GRANT ALL/i);
    expect(SQL).not.toMatch(/WITH GRANT OPTION/i);
    expect(SQL).not.toMatch(/GRANT[^;]*\b(TRUNCATE|REFERENCES|TRIGGER|CREATE)\b[^;]*TO app_reservas/i);
    expect(SQL).not.toMatch(/ALTER ROLE|SUPERUSER|CREATEDB|CREATEROLE/i);
  });
});
