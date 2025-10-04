import pandas as pd
import numpy as np # Import numpy for better data generation

def load_historical_data(filepath: str) -> pd.DataFrame:
    """Carrega dados históricos de um arquivo CSV."""
    try:
        df = pd.read_csv(
            filepath,
            names=['timestamp', 'open', 'high', 'low', 'close', 'volume'],
            index_col='timestamp',
            parse_dates=True
        )
        print(f"Dados históricos carregados com sucesso de {filepath}")
        return df
    except FileNotFoundError:
        print(f"ERRO: Arquivo de dados não encontrado em {filepath}")
        print("Criando dados de exemplo para demonstração...")
        
        # --- CORREÇÃO ---
        # Gerando dados de exemplo mais realistas e sem valores NaN
        dates = pd.to_datetime(pd.date_range(start="2023-01-01", periods=1000, freq="h"))
        # Cria um movimento de preço com alguma aleatoriedade
        price_changes = 1 + np.random.randn(1000) * 0.01
        price = 30000 * price_changes.cumprod()
        
        df = pd.DataFrame({'close': price}, index=dates)
        return df