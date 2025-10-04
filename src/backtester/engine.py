import pandas as pd
from src.strategy_engine.grid_logic import GridStrategy

class BacktestEngine:
    def __init__(self, strategy: GridStrategy, initial_capital=1000.0, commission_pct=0.005):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.commission_pct = commission_pct
        self.reset()

    def reset(self):
        """Reseta o estado do motor para uma nova simulação."""
        self.capital = self.initial_capital
        self.position_size = 0.0
        self.trades = []
        self.portfolio_value = [self.initial_capital]

    def run(self, data: pd.DataFrame):
        """Executa o backtest nos dados históricos."""
        print("\n--- Iniciando Backtest ---")
        for timestamp, row in data.iterrows():
            market_price = row['close']
            
            signals = self.strategy.process_price_update(market_price)
            
            for signal in signals:
                self._execute_trade(signal, market_price, timestamp)
            
            current_value = self.capital + (self.position_size * market_price)
            self.portfolio_value.append(current_value)
            
        print("--- Backtest Concluído ---\n")
        # --- CORREÇÃO ---
        # Passa os 'dados' para a função de gerar o relatório
        return self._generate_report(data)

    def _execute_trade(self, signal: dict, price: float, timestamp):
        """Simula a execução de uma ordem."""
        quantity = signal['quantity']
        trade_value = quantity * price
        commission = trade_value * self.commission_pct
        
        if signal['side'] == 'BUY':
            self.position_size += quantity
            self.capital -= (trade_value + commission)
        elif signal['side'] == 'SELL':
            self.position_size -= quantity
            self.capital += (trade_value - commission)
            
        self.trades.append({
            "timestamp": timestamp, "side": signal['side'], 
            "quantity": quantity, "price": price
        })

    def _generate_report(self, data: pd.DataFrame): # <-- A variável 'data' agora é um parâmetro
        """Gera e imprime um relatório de performance."""
        portfolio = pd.Series(self.portfolio_value)
        
        total_return = (portfolio.iloc[-1] / self.initial_capital - 1) * 100
        
        rolling_max = portfolio.cummax()
        daily_drawdown = portfolio / rolling_max - 1.0
        max_drawdown = daily_drawdown.min() * 100
        
        report = {
            "Período Analisado": f"{data.index.min()} a {data.index.max()}",
            "Capital Inicial": f"${self.initial_capital:,.2f}",
            "Capital Final": f"${portfolio.iloc[-1]:,.2f}",
            "Retorno Total": f"{total_return:.2f}%",
            "Drawdown Máximo": f"{max_drawdown:.2f}%",
            "Total de Trades": len(self.trades)
        }

        print("--- Relatório de Performance do Backtest ---")
        for key, value in report.items():
            print(f"{key:<20} {value}")
        print("-------------------------------------------")
        return report