import os
import psycopg2
from psycopg2.extras import DictCursor

class PostgresManager:
    def __init__(self):
        try:
            self.conn = psycopg2.connect(
                host=os.getenv("POSTGRES_HOST", "localhost"),
                database=os.getenv("POSTGRES_DB"),
                user=os.getenv("POSTGRES_USER"),
                password=os.getenv("POSTGRES_PASSWORD")
            )
            print("Conexão com o PostgreSQL estabelecida com sucesso.")
        except Exception as e:
            print(f"Erro ao conectar com o PostgreSQL: {e}")
            raise

    def execute_query(self, query, params=None, fetch=None):
        """Executa uma query no banco de dados."""
        with self.conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(query, params)
            self.conn.commit()
            if fetch == "one":
                return cur.fetchone()
            if fetch == "all":
                return cur.fetchall()
        return None