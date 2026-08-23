"""
Finéa - Backend Flask
=====================
Servidor responsável por:
  1) Servir o frontend (index.html, FrontEnd/style.css, BackEnd/script.js).
  2) Expor API RESTful para gerenciar estado da aplicação.
  3) Persistir dados completos em SQLite em vez de localStorage.

Como rodar:
  pip install -r requirements.txt
  python app.py
  -> Abre em http://localhost:5000

Variáveis de ambiente (.env):
  PORT: porta do servidor (padrão: 5000)
  DEBUG: modo debug (padrão: 1 para ativo)
  DB_PATH: caminho do banco SQLite (padrão: finea.db)
"""

# ==========================================
# IMPORTAÇÕES E CONFIGURAÇÕES
# ==========================================
import os
import json
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

# Carrega variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações de diretórios e banco de dados
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, os.getenv("DB_PATH", "finea.db"))
DEFAULT_USER = "default"  # ID padrão do usuário (preparado para multi-usuário no futuro)

# Inicializa aplicação Flask
app = Flask(__name__, static_folder=None)

# ==========================================
# UTILITÁRIOS DE BANCO DE DADOS
# ==========================================

def get_conn():
    """
    Retorna uma conexão SQLite com row factory para leitura por nome.
    
    Row factory permite acessar colunas por nome:
    row['payload'] em vez de row[0]
    
    Returns:
        sqlite3.Connection: Conexão com o banco de dados
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Permite acessar colunas pelo nome
    return conn


def init_db():
    """
    Cria a tabela de armazenamento se ela ainda não existir.

    Estratégia: Guardamos o estado inteiro do app como JSON em uma tabela única.
    Benefícios:
      - Preserva a estrutura que o frontend já conhece
      - Simplifica sincronização frontend-backend
      - Evita complexidade de múltiplas tabelas relacionais
      - Facilita backup/restore completo
    """
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                usuario TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                atualizado_em TEXT NOT NULL
            )
            """
        )
        conn.commit()


# Inicializa banco de dados na startup
init_db()


# ==========================================
# ROTAS DE API (Gestão de Dados)
# ==========================================

@app.get("/api/data")
def get_data():
    """
    Retorna o estado salvo do app.
    
    Response:
        dict: Estado completo do app (contas, transações, etc) ou null
    """
    with get_conn() as conn:
        row = conn.execute(
            "SELECT payload FROM app_state WHERE usuario = ?",
            (DEFAULT_USER,),
        ).fetchone()
    
    # Retorna null se nenhum dado foi salvo ainda
    if row is None:
        return jsonify(None)
    
    return jsonify(json.loads(row["payload"]))


@app.post("/api/data")
def save_data():
    """
    Grava o estado completo do app enviado pelo frontend.
    
    Usa UPSERT para atualizar se já existe ou inserir se é novo.
    Registra timestamp de atualização para auditoria.
    
    Returns:
        dict: Confirmação de sucesso {ok: true}
    """
    payload = request.get_json(silent=True)
    
    # Valida se corpo JSON é válido
    if payload is None:
        return jsonify({"erro": "corpo JSON inválido"}), 400

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO app_state (usuario, payload, atualizado_em)
            VALUES (?, ?, ?)
            ON CONFLICT(usuario) DO UPDATE SET
                payload = excluded.payload,
                atualizado_em = excluded.atualizado_em
            """,
            (DEFAULT_USER, json.dumps(payload, ensure_ascii=False), datetime.utcnow().isoformat()),
        )
        conn.commit()
    
    return jsonify({"ok": True})


@app.delete("/api/data")
def reset_data():
    """
    Remove o estado salvo para que o frontend possa recriar os dados padrão.
    
    Útil para: reset manual, testes, troubleshooting.
    
    Returns:
        dict: Confirmação de sucesso {ok: true}
    """
    with get_conn() as conn:
        conn.execute("DELETE FROM app_state WHERE usuario = ?", (DEFAULT_USER,))
        conn.commit()
    
    return jsonify({"ok": True})


@app.get("/api/ping")
def ping():
    """
    Health check - verifica se o servidor está respondendo.
    
    Returns:
        dict: Status do servidor e timestamp UTC
    """
    return jsonify({"status": "ok", "hora": datetime.utcnow().isoformat()})


# ==========================================
# ROTAS DE ARQUIVOS ESTÁTICOS (Frontend)
# ==========================================

@app.get("/")
def home():
    """
    Serve a página principal da aplicação.
    """
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/FrontEnd/<path:filename>")
def frontend_files(filename):
    """
    Serve arquivos do frontend (CSS, etc).
    
    Args:
        filename: Nome do arquivo solicitado
    """
    return send_from_directory(os.path.join(BASE_DIR, "FrontEnd"), filename)


@app.get("/BackEnd/<path:filename>")
def backend_files(filename):
    """
    Serve arquivos do backend (JavaScript do frontend, etc).
    
    Args:
        filename: Nome do arquivo solicitado
    """
    return send_from_directory(os.path.join(BASE_DIR, "BackEnd"), filename)


# ==========================================
# INICIALIZAÇÃO DO SERVIDOR
# ==========================================

if __name__ == "__main__":
    # Lê configurações do .env
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "1") == "1"
    
    # Inicia o servidor Flask
    app.run(host="0.0.0.0", port=port, debug=debug)
