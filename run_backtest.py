from src.strategy_engine.grid_logic import GridStrategy
from src.backtester.engine import BacktestEngine
from src.backtester.data_provider import load_historical_data

if __name__ == "__main__":
    print("Configurando simulação de backtest...")

    # 1. Carrega os dados históricos
    # Crie um arquivo 'data.csv' na raiz ou deixe que ele crie dados de exemplo.
    data = load_historical_data('data.csv')

    # 2. Configura a estratégia com os mesmos parâmetros do nosso ambiente real
    strategy = GridStrategy(
        grid_levels=10,
        grid_spacing_pct=0.5,
        order_size=0.0001
    )

    # 3. Inicializa e executa o motor de backtest
    backtester = BacktestEngine(strategy)
    report = backtester.run(data)